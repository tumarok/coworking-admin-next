import type { Booking } from '@/lib/contract/booking';
import { formatDateTime, formatTimeRange } from '@/lib/format-date';
import { FALLBACK_ZONE } from '@/features/bookings/constants';

/** `12 Oct 2026, 09:00–11:30` on the clock of the booking's location; UTC, said so, if unknown. */
export const bookingRange = (booking: Booking, zone: string | undefined) =>
  zone
    ? formatTimeRange(booking.startsAt, booking.endsAt, zone)
    : `${formatTimeRange(booking.startsAt, booking.endsAt, FALLBACK_ZONE)} UTC`;

/** One instant of a booking on the same clock. */
export const bookingInstant = (iso: string, zone: string | undefined) =>
  zone ? formatDateTime(iso, zone) : `${formatDateTime(iso, FALLBACK_ZONE)} UTC`;
