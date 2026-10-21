'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PencilIcon, TrashIcon } from 'lucide-react';
import { DetailsList } from '@/components/details-list';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { RoomStatusBadge } from '@/components/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/config/routes';
import { ApiError } from '@/lib/api/errors';
import { humanize } from '@/lib/humanize';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { roomQuery } from '@/features/rooms/api/room-queries';
import { AmenityBadges } from '@/features/rooms/components/amenity-badges';
import { DeleteRoomDialog } from '@/features/rooms/components/delete-room-dialog';
import { RoomFormDialog } from '@/features/rooms/components/room-form-dialog';

/** One room: its fields, edit and delete. Failures are explained on the page, not in a toast. */
export function RoomDetails({ id }: { id: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // After a delete the record is gone; until the list opens the page must not ask for it again.
  const [deleted, setDeleted] = useState(false);
  const query = useQuery(roomQuery(id, { enabled: !deleted }));

  if (query.isPending || deleted) {
    return (
      <div role="status" aria-label="Loading room" className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // A failed refetch in the background keeps the data on screen; only a missing record is an error.
  if (query.data === undefined) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return notFound ? (
      <EmptyState title="Room not found">
        <p>It may have been deleted.</p>
        <Link href={ROUTES.rooms} className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
          All rooms
        </Link>
      </EmptyState>
    ) : (
      <EmptyState title="Could not load the room">
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

  const room = query.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={room.name}
        subtitle={`${humanize(room.type)} at ${room.locationName}`}
        back={{ href: ROUTES.rooms, label: 'Rooms' }}
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
              { label: 'Status', value: <RoomStatusBadge status={room.status} /> },
              { label: 'Type', value: humanize(room.type) },
              {
                label: 'Location',
                value: (
                  <Link
                    href={ROUTES.location(room.locationId)}
                    className="hover:underline focus-visible:underline"
                  >
                    {room.locationName}
                  </Link>
                ),
              },
              { label: 'Capacity', value: `${room.capacity} seats` },
              { label: 'Rate', value: `${formatMoney(room.hourlyRate)} / hour` },
              { label: 'Amenities', value: <AmenityBadges amenities={room.amenities} /> },
            ]}
          />
        </CardContent>
      </Card>

      <RoomFormDialog open={editing} onOpenChange={setEditing} room={room} />
      <DeleteRoomDialog
        room={room}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => {
          setDeleted(true);
          router.replace(ROUTES.rooms);
        }}
      />
    </div>
  );
}
