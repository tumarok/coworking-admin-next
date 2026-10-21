import { describe, expect, it } from 'vitest';
import type { Booking } from '@/lib/contract/booking';
import { bookingInstant, bookingRange } from './format';

const BOOKING = {
  startsAt: '2026-07-01T06:00:00.000Z',
  endsAt: '2026-07-01T07:30:00.000Z',
} as Booking;

describe('bookingRange', () => {
  it('prints the range on the clock of the zone', () => {
    expect(bookingRange(BOOKING, 'Europe/Kyiv')).toBe('1 Jul 2026, 09:00–10:30');
    expect(bookingRange(BOOKING, 'Europe/Lisbon')).toBe('1 Jul 2026, 07:00–08:30');
  });

  it('falls back to UTC and says so when the zone is unknown', () => {
    expect(bookingRange(BOOKING, undefined)).toBe('1 Jul 2026, 06:00–07:30 UTC');
  });
});

describe('bookingInstant', () => {
  it('prints an instant on the clock of the zone, or in UTC with a mark', () => {
    expect(bookingInstant(BOOKING.startsAt, 'Europe/Kyiv')).toBe('1 Jul 2026, 09:00');
    expect(bookingInstant(BOOKING.startsAt, undefined)).toBe('1 Jul 2026, 06:00 UTC');
  });
});
