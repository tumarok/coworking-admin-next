'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookingStatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/config/routes';
import type { Dashboard } from '@/lib/contract/dashboard';
import { formatTimeRangeIn } from '@/lib/format-date';
import { locationZonesQuery } from '@/features/dashboard/api/dashboard-queries';

/**
 * The next bookings from now on, whatever day the dashboard shows. Each time is printed on the
 * clock of its location; a booking carries only the location's id, so the zones are looked up.
 */
export function UpcomingCard({ upcoming }: { upcoming: Dashboard['upcoming'] }) {
  // The zones are read here, under the dashboard's own root, not through the bookings feature:
  // features do not import each other, and every change to a location refreshes this root.
  const locations = useQuery(locationZonesQuery());
  const zones = new Map((locations.data?.items ?? []).map((l) => [l.id, l.timezone]));
  const ready = !locations.isPending;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>
          <h2>Coming up</h2>
        </CardTitle>
        <Link
          href={ROUTES.bookings}
          className="text-sm font-medium hover:underline focus-visible:underline"
        >
          All bookings
        </Link>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
        ) : (
          <ul className="divide-y">
            {upcoming.map((booking) => (
              <li
                key={booking.id}
                className="grid items-center gap-1 py-3 first:pt-0 last:pb-0 min-[56.25rem]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] min-[56.25rem]:gap-4"
              >
                <Link
                  href={ROUTES.booking(booking.id)}
                  className="font-medium hover:underline focus-visible:underline"
                >
                  {ready
                    ? formatTimeRangeIn(
                        booking.startsAt,
                        booking.endsAt,
                        zones.get(booking.locationId),
                      )
                    : '…'}
                </Link>
                <span className="text-sm">
                  {booking.roomName} · {booking.locationName}
                </span>
                <span className="text-sm text-muted-foreground">{booking.memberName}</span>
                <span>
                  <BookingStatusBadge status={booking.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
