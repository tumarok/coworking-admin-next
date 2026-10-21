import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import type { BookingConflict } from '@/lib/contract/common';
import { formatTimeRange } from '@/lib/format-date';

interface BookingConflictsProps {
  conflicts: readonly BookingConflict[];
  /** Zone of the room's location: the times are the ones the user typed. */
  timeZone: string;
  /** For moving the focus here after a refused save. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Why a save was refused: the bookings that already hold the room, each a link to its page.
 * The form shows it only when there is at least one.
 */
export function BookingConflicts({ conflicts, timeZone, ref }: BookingConflictsProps) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="font-semibold">The room is already booked for this time.</p>
      <ul className="mt-1 list-disc pl-5">
        {conflicts.map((conflict) => (
          <li key={conflict.id}>
            <Link
              href={ROUTES.booking(conflict.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {formatTimeRange(conflict.startsAt, conflict.endsAt, timeZone)}{' '}
              <span className="sr-only">(opens in a new tab)</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
