import { BookingStatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BOOKING_STATUSES } from '@/lib/contract/booking';
import type { Dashboard } from '@/lib/contract/dashboard';
import { barPercent } from '@/features/dashboard/constants';

/** How many of the day's bookings are in each status; the bars are drawn, the numbers are read. */
export function StatusCard({ byStatus }: { byStatus: Dashboard['byStatus'] }) {
  const counts = BOOKING_STATUSES.map((status) => ({ status, count: byStatus[status] }));
  const max = Math.max(0, ...counts.map((row) => row.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Bookings by status</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {counts.map(({ status, count }) => (
            <li key={status} className="flex items-center gap-3">
              <span className="w-28 shrink-0">
                <BookingStatusBadge status={status} />
              </span>
              <span aria-hidden className="h-2 min-w-0 flex-1 rounded-full bg-muted">
                <span
                  role="presentation"
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${barPercent(count, max)}%` }}
                />
              </span>
              <strong className="w-8 text-right tabular-nums">{count}</strong>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
