import { describe, expect, it } from 'vitest';
import { bookingInputSchema, type Booking } from '@/lib/contract/booking';
import {
  BOOKING_FORM_DEFAULTS,
  bookingFormSchema,
  seatsError,
  spansDays,
  toBookingInput,
  toFormValues,
  type BookingFormValues,
} from './schemas';

const VALID: BookingFormValues = {
  roomId: 'room_1',
  memberId: 'mem_1',
  date: '2026-07-01',
  startTime: '09:00',
  endTime: '10:30',
  attendees: 3,
  notes: 'Bring the projector',
};

/** Message under each field that has one. */
const messages = (values: Partial<Record<keyof BookingFormValues, unknown>>) => {
  const result = bookingFormSchema.safeParse({ ...VALID, ...values });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe('bookingFormSchema', () => {
  it('accepts a complete form', () => {
    expect(bookingFormSchema.safeParse(VALID).success).toBe(true);
  });

  it('asks for what is missing', () => {
    expect(messages(BOOKING_FORM_DEFAULTS)).toEqual({
      roomId: 'Choose a room',
      memberId: 'Choose a member',
      date: 'Pick a date',
    });
  });

  it('asks for a time when one is blank', () => {
    expect(messages({ startTime: '', endTime: '' })).toEqual({
      startTime: 'Enter a start time',
      endTime: 'Enter an end time',
    });
  });

  it('puts an end that is not after the start under the end time', () => {
    expect(messages({ startTime: '10:00', endTime: '10:00' })).toEqual({
      endTime: 'End must be after start',
    });
    expect(messages({ startTime: '10:00', endTime: '09:00' })).toEqual({
      endTime: 'End must be after start',
    });
  });

  it('allows exactly the longest stay and refuses a minute more', () => {
    expect(messages({ startTime: '09:00', endTime: '17:00' })).toEqual({});
    expect(messages({ startTime: '09:00', endTime: '17:15' })).toEqual({
      endTime: 'A booking cannot be longer than 8 hours',
    });
  });

  it('wants at least one whole attendee', () => {
    expect(messages({ attendees: Number.NaN })).toEqual({ attendees: 'Enter a number' });
    expect(messages({ attendees: 0 })).toEqual({ attendees: 'At least 1 person' });
    expect(messages({ attendees: 2.5 })).toEqual({ attendees: 'Use a whole number' });
  });

  it('limits the notes', () => {
    expect(messages({ notes: 'x'.repeat(501) })).toEqual({ notes: 'At most 500 characters' });
    expect(messages({ notes: 'x'.repeat(500) })).toEqual({});
  });
});

describe('seatsError', () => {
  it('names the seats when there are more guests than that', () => {
    expect(seatsError(7, 6)).toBe('This room seats up to 6');
  });

  it('is silent while everyone fits', () => {
    expect(seatsError(6, 6)).toBeNull();
    expect(seatsError(1, 6)).toBeNull();
  });
});

describe('toBookingInput', () => {
  it('reads the times on the clock of the zone and sends UTC instants the contract accepts', () => {
    const input = toBookingInput(VALID, 'Europe/Kyiv');

    expect(input).toEqual({
      roomId: 'room_1',
      memberId: 'mem_1',
      startsAt: '2026-07-01T06:00:00.000Z',
      endsAt: '2026-07-01T07:30:00.000Z',
      attendees: 3,
      notes: 'Bring the projector',
    });
    expect(bookingInputSchema.safeParse(input).success).toBe(true);
  });

  it('gives the same wall clock a different instant in another zone and in winter', () => {
    expect(toBookingInput(VALID, 'Europe/Lisbon').startsAt).toBe('2026-07-01T08:00:00.000Z');
    expect(toBookingInput({ ...VALID, date: '2026-01-15' }, 'Europe/Kyiv').startsAt).toBe(
      '2026-01-15T07:00:00.000Z',
    );
  });

  it('uses the summer offset on the day the clocks change, once the hour has passed', () => {
    const input = toBookingInput(
      { ...VALID, date: '2026-03-29', startTime: '10:00', endTime: '11:30' },
      'Europe/Berlin',
    );

    expect(input.startsAt).toBe('2026-03-29T08:00:00.000Z');
    expect(input.endsAt).toBe('2026-03-29T09:30:00.000Z');
  });

  it('sends no notes as null', () => {
    expect(toBookingInput({ ...VALID, notes: '' }, 'Europe/Kyiv').notes).toBeNull();
  });
});

describe('toFormValues', () => {
  const BOOKING: Booking = {
    id: 'bk_1',
    roomId: 'room_1',
    roomName: 'Atrium',
    locationId: 'loc_1',
    locationName: 'Riverside Hub',
    memberId: 'mem_1',
    memberName: 'Ada Lovelace',
    startsAt: '2026-07-01T06:00:00.000Z',
    endsAt: '2026-07-01T07:30:00.000Z',
    attendees: 3,
    status: 'pending',
    notes: null,
    totalPrice: 4500,
    createdAt: '2026-06-01T10:00:00.000Z',
  };

  it('starts a new booking from the defaults', () => {
    expect(toFormValues()).toEqual(BOOKING_FORM_DEFAULTS);
    expect(BOOKING_FORM_DEFAULTS).toMatchObject({
      startTime: '09:00',
      endTime: '10:00',
      attendees: 1,
    });
  });

  it('shows a booking on the clock of its zone, with no notes as blank text', () => {
    expect(toFormValues(BOOKING, 'Europe/Kyiv')).toEqual({
      roomId: 'room_1',
      memberId: 'mem_1',
      date: '2026-07-01',
      startTime: '09:00',
      endTime: '10:30',
      attendees: 3,
      notes: '',
    });
  });

  it('falls back to UTC when the zone is unknown', () => {
    expect(toFormValues(BOOKING)).toMatchObject({ date: '2026-07-01', startTime: '06:00' });
  });

  it('turns back into the same instants it was made from', () => {
    const values = toFormValues(BOOKING, 'Europe/Kyiv');

    expect(toBookingInput(values, 'Europe/Kyiv')).toMatchObject({
      startsAt: BOOKING.startsAt,
      endsAt: BOOKING.endsAt,
      notes: null,
    });
  });
});

describe('spansDays', () => {
  const BOOKING = {
    startsAt: '2026-07-01T20:00:00.000Z',
    endsAt: '2026-07-01T22:30:00.000Z',
  } as Booking;

  it('is false for a booking inside one day of the zone', () => {
    expect(spansDays(BOOKING, 'Europe/Lisbon')).toBe(false);
  });

  it('is true when midnight of the zone falls inside the booking', () => {
    // 20:00–22:30 UTC is 23:00–01:30 in Kyiv in July.
    expect(spansDays(BOOKING, 'Europe/Kyiv')).toBe(true);
  });

  it('reads the dates in UTC when the zone is unknown', () => {
    expect(spansDays(BOOKING)).toBe(false);
  });
});
