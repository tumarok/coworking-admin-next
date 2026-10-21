'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PencilIcon, TrashIcon } from 'lucide-react';
import { DetailsList } from '@/components/details-list';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { LocationStatusBadge } from '@/components/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/config/routes';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { locationQuery } from '@/features/locations/api/location-queries';
import { DeleteLocationDialog } from '@/features/locations/components/delete-location-dialog';
import { LocationFormDialog } from '@/features/locations/components/location-form-dialog';

/** One location: its fields, edit and delete. Failures are explained on the page, not in a toast. */
export function LocationDetails({ id }: { id: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // After a delete the record is gone; until the list opens the page must not ask for it again.
  const [deleted, setDeleted] = useState(false);
  const query = useQuery(locationQuery(id, { enabled: !deleted }));

  if (query.isPending || deleted) {
    return (
      <div role="status" aria-label="Loading location" className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // A failed refetch in the background keeps the data on screen; only a missing record is an error.
  if (query.data === undefined) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return notFound ? (
      <EmptyState title="Location not found">
        <p>It may have been deleted.</p>
        <Link
          href={ROUTES.locations}
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
        >
          All locations
        </Link>
      </EmptyState>
    ) : (
      <EmptyState title="Could not load the location">
        <p>{query.error.message}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            void query.refetch();
          }}
        >
          Try again
        </Button>
      </EmptyState>
    );
  }

  const location = query.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={location.name}
        subtitle={`${location.address}, ${location.city}`}
        back={{ href: ROUTES.locations, label: 'Locations' }}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(true);
              }}
            >
              <PencilIcon aria-hidden />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleting(true);
              }}
            >
              <TrashIcon aria-hidden />
              Delete
            </Button>
          </>
        }
      />

      <Card>
        <CardContent>
          <DetailsList
            items={[
              { label: 'Status', value: <LocationStatusBadge status={location.status} /> },
              { label: 'City', value: location.city },
              { label: 'Address', value: location.address },
              { label: 'Time zone', value: location.timezone },
              { label: 'Opening hours', value: `${location.opensAt}–${location.closesAt}` },
              { label: 'Rooms', value: location.roomCount },
            ]}
          />
        </CardContent>
      </Card>

      <LocationFormDialog open={editing} onOpenChange={setEditing} location={location} />
      <DeleteLocationDialog
        location={location}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => {
          setDeleted(true);
          router.replace(ROUTES.locations);
        }}
      />
    </div>
  );
}
