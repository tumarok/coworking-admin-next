import type { Booking } from '@/lib/contract/booking';
import { formatDateTimeIn, formatTimeRangeIn } from '@/lib/format-date';

/** `12 Oct 2026, 09:00–11:30` on the clock of the booking's location; UTC, said so, if unknown. */
export const bookingRange = (booking: Booking, zone: string | undefined) =>
  formatTimeRangeIn(booking.startsAt, booking.endsAt, zone);

/** One instant of a booking on the same clock. */
export const bookingInstant = (iso: string, zone: string | undefined) =>
  formatDateTimeIn(iso, zone);
