import { describe, expect, it } from 'vitest';
import {
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  bookingInputSchema,
  bulkBookingRequestSchema,
  canTransition,
} from './booking';

const input = {
  roomId: 'room_1',
  memberId: 'mem_1',
  startsAt: '2026-10-14T09:00:00.000Z',
  endsAt: '2026-10-14T10:30:00.000Z',
  attendees: 2,
  notes: null,
};

const endsAtError = (endsAt: string) => {
  const result = bookingInputSchema.safeParse({ ...input, endsAt });
  return result.error?.issues.find((issue) => issue.path.join('.') === 'endsAt')?.message;
};

describe('bookingInputSchema', () => {
  it('accepts a booking within the length limit', () => {
    expect(bookingInputSchema.safeParse(input).success).toBe(true);
    expect(endsAtError('2026-10-14T17:00:00.000Z')).toBeUndefined();
  });

  it('rejects an end that is not after the start', () => {
    expect(endsAtError('2026-10-14T09:00:00.000Z')).toBe('End must be after start');
    expect(endsAtError('2026-10-14T08:00:00.000Z')).toBe('End must be after start');
  });

  it('rejects a booking longer than 8 hours', () => {
    expect(endsAtError('2026-10-14T17:00:01.000Z')).toBe('A booking cannot be longer than 8 hours');
  });

  it('requires the notes key but allows null, and trims the text', () => {
    const { notes: _notes, ...withoutNotes } = input;

    expect(bookingInputSchema.safeParse(withoutNotes).success).toBe(false);
    expect(bookingInputSchema.parse({ ...input, notes: '  window seat ' }).notes).toBe(
      'window seat',
    );
  });

  it('requires at least one attendee', () => {
    const result = bookingInputSchema.safeParse({ ...input, attendees: 0 });

    expect(result.error?.issues[0]?.message).toBe('At least 1 attendee');
  });
});

describe('booking status transitions', () => {
  it('allows only the moves listed for the current status', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'no_show')).toBe(true);
    expect(canTransition('pending', 'checked_in')).toBe(false);
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
  });

  it('has no way out of the terminal statuses', () => {
    const terminal = BOOKING_STATUSES.filter((status) => BOOKING_TRANSITIONS[status].length === 0);

    expect(terminal).toEqual(['completed', 'cancelled', 'no_show']);
  });
});

describe('bulkBookingRequestSchema', () => {
  it('accepts 1 to 100 ids and a known action', () => {
    expect(bulkBookingRequestSchema.safeParse({ ids: ['bk_1'], action: 'confirm' }).success).toBe(
      true,
    );
    expect(bulkBookingRequestSchema.safeParse({ ids: [], action: 'cancel' }).success).toBe(false);
    expect(
      bulkBookingRequestSchema.safeParse({
        ids: Array.from({ length: 101 }, (_, i) => `bk_${i}`),
        action: 'cancel',
      }).success,
    ).toBe(false);
    expect(bulkBookingRequestSchema.safeParse({ ids: ['bk_1'], action: 'delete' }).success).toBe(
      false,
    );
  });
});
