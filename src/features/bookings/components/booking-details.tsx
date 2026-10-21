'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PencilIcon } from 'lucide-react';
import { DetailsList } from '@/components/details-list';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { BookingStatusBadge } from '@/components/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/config/routes';
import { ApiError } from '@/lib/api/errors';
import { durationHours } from '@/lib/format-date';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { bookingQuery } from '@/features/bookings/api/booking-queries';
import { useLocationZones } from '@/features/bookings/api/booking-zones';
import { BookingFormDialog } from '@/features/bookings/components/booking-form-dialog';
import { BookingStatusActions } from '@/features/bookings/components/booking-status-actions';
import { isDeleted, locationText, memberText, roomText } from '@/features/bookings/constants';
import { bookingInstant, bookingRange } from '@/features/bookings/format';

/** One booking: its fields, the status changes and edit. Failures are explained on the page. */
export function BookingDetails({ id }: { id: string }) {
  const [editing, setEditing] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const query = useQuery(bookingQuery(id));
  const zones = useLocationZones();

  if (query.isPending || !zones.ready) {
    return (
      <div role="status" aria-label="Loading booking" className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // A failed refetch in the background keeps the data on screen; only a missing record is an error.
  if (query.data === undefined) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return notFound ? (
      <EmptyState title="Booking not found">
        <p>Check the link and try again.</p>
        <Link href={ROUTES.bookings} className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
          All bookings
        </Link>
      </EmptyState>
    ) : (
      <EmptyState title="Could not load the booking">
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

  const booking = query.data;
  const zone = zones.zoneOf(booking.locationId);
  const editable = booking.status === 'pending' || booking.status === 'confirmed';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${roomText(booking.roomName)}, ${bookingRange(booking, zone)}`}
        back={{ href: ROUTES.bookings, label: 'Bookings' }}
        titleRef={titleRef}
        actions={
          <>
            <BookingStatusActions
              booking={booking}
              onSettled={() => {
                titleRef.current?.focus();
              }}
            />
            {editable && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(true);
                }}
              >
                <PencilIcon aria-hidden />
                Edit
              </Button>
            )}
          </>
        }
      />

      <Card>
        <CardContent>
          <DetailsList
            items={[
              { label: 'Status', value: <BookingStatusBadge status={booking.status} /> },
              { label: 'Room', value: roomText(booking.roomName) },
              {
                label: 'Location',
                value: !isDeleted(booking.locationName) ? (
                  <Link
                    href={ROUTES.location(booking.locationId)}
                    className="hover:underline focus-visible:underline"
                  >
                    {locationText(booking.locationName)}
                  </Link>
                ) : (
                  locationText(booking.locationName)
                ),
              },
              {
                label: 'Member',
                value: isDeleted(booking.memberName) ? (
                  memberText(booking.memberName)
                ) : (
                  <Link
                    href={ROUTES.member(booking.memberId)}
                    className="hover:underline focus-visible:underline"
                  >
                    {memberText(booking.memberName)}
                  </Link>
                ),
              },
              { label: 'Starts', value: bookingInstant(booking.startsAt, zone) },
              { label: 'Ends', value: bookingInstant(booking.endsAt, zone) },
              {
                label: 'Duration',
                value: `${durationHours(booking.startsAt, booking.endsAt)} h`,
              },
              { label: 'Attendees', value: booking.attendees },
              { label: 'Price', value: formatMoney(booking.totalPrice) },
              { label: 'Created', value: bookingInstant(booking.createdAt, zone) },
              { label: 'Notes', value: booking.notes },
            ]}
          />
        </CardContent>
      </Card>

      <BookingFormDialog open={editing} onOpenChange={setEditing} booking={booking} />
    </div>
  );
}
