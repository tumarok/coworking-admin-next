import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ROUTES } from '@/config/routes';
import type { Dashboard } from '@/lib/contract/dashboard';
import { occupancyPercent } from '@/features/dashboard/constants';

/** Booked against bookable hours of each active location, as a CSS bar. */
export function OccupancyCard({ occupancy }: { occupancy: Dashboard['occupancy'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Occupancy by location</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {occupancy.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active locations.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {occupancy.map((row) => (
              <li key={row.locationId} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <Link
                    href={ROUTES.location(row.locationId)}
                    className="font-medium hover:underline focus-visible:underline"
                  >
                    {row.locationName}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">
                    {row.bookedHours} of {row.availableHours} h
                  </span>
                </div>
                <Progress
                  value={occupancyPercent(row.bookedHours, row.availableHours)}
                  aria-label={`${row.locationName} occupancy`}
                  className="[&_[data-slot=progress-track]]:h-2"
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
