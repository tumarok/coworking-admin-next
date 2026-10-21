import * as z from 'zod';
import { MAX_BOOKING_HOURS, type Booking, type BookingInput } from '@/lib/contract/booking';
import { utcToZoned, zonedToUtcIso } from '@/lib/timezone';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

/**
 * The form takes a day and two times on the wall clock of the room's location; the API takes two
 * UTC instants (`toBookingInput` converts). The end is checked against the start here, with the
 * messages of the contract. The seats of the chosen room are not part of the schema (the room is a
 * lookup, not a form value): the form checks them with `seatsError` before it sends anything.
 */
export const bookingFormSchema = z
  .object({
    roomId: z.string().min(1, { error: 'Choose a room' }),
    memberId: z.string().min(1, { error: 'Choose a member' }),
    date: z.string().regex(DATE, { error: 'Pick a date' }),
    startTime: z.string().regex(TIME, { error: 'Enter a start time' }),
    endTime: z.string().regex(TIME, { error: 'Enter an end time' }),
    attendees: z
      .number({ error: 'Enter a number' })
      .int({ error: 'Use a whole number' })
      .min(1, { error: 'At least 1 person' }),
    notes: z.string().trim().max(500, { error: 'At most 500 characters' }),
  })
  .superRefine((values, ctx) => {
    // A time that is not a time has its own message; the order is judged on valid times only.
    if (!TIME.test(values.startTime) || !TIME.test(values.endTime)) return;
    const hours = (minutesOf(values.endTime) - minutesOf(values.startTime)) / 60;
    if (hours <= 0) {
      ctx.addIssue({ code: 'custom', message: 'End must be after start', path: ['endTime'] });
    } else if (hours > MAX_BOOKING_HOURS) {
      ctx.addIssue({
        code: 'custom',
        message: `A booking cannot be longer than ${MAX_BOOKING_HOURS} hours`,
        path: ['endTime'],
      });
    }
  });

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

/** The message for more guests than the room seats, or `null` when they fit. */
export const seatsError = (attendees: number, capacity: number) =>
  attendees > capacity ? `This room seats up to ${capacity}` : null;

export const BOOKING_FORM_DEFAULTS: BookingFormValues = {
  roomId: '',
  memberId: '',
  date: '',
  startTime: '09:00',
  endTime: '10:00',
  attendees: 1,
  notes: '',
};

/** Field names a 422 can point at; the API's `startsAt` and `endsAt` are the two times. */
export const BOOKING_FORM_FIELDS = Object.keys(BOOKING_FORM_DEFAULTS) as Array<
  keyof BookingFormValues
>;
export const BOOKING_FIELD_ALIASES = { startsAt: 'startTime', endsAt: 'endTime' } as const;

/**
 * Form values of a booking being edited, with its times on the clock of `timeZone` (the zone of
 * its location); defaults for a new one.
 */
export const toFormValues = (booking?: Booking, timeZone = 'UTC'): BookingFormValues => {
  if (!booking) return BOOKING_FORM_DEFAULTS;
  const start = utcToZoned(booking.startsAt, timeZone);
  const end = utcToZoned(booking.endsAt, timeZone);
  return {
    roomId: booking.roomId,
    memberId: booking.memberId,
    date: start.date,
    startTime: start.time,
    // A booking that ends on another day cannot be written as one day (`spansDays`); the form
    // shows the end time alone and refuses to save it.
    endTime: end.time,
    attendees: booking.attendees,
    notes: booking.notes ?? '',
  };
};

/**
 * Whether the booking ends on another calendar day than it starts, on the clock of `timeZone`.
 * The form has one day and two times, so saving such a booking would silently shorten it.
 */
export const spansDays = (booking: Booking, timeZone = 'UTC') =>
  utcToZoned(booking.startsAt, timeZone).date !== utcToZoned(booking.endsAt, timeZone).date;

/** The request body for the values of the form: the times are read on the clock of `timeZone`. */
export const toBookingInput = (values: BookingFormValues, timeZone: string): BookingInput => ({
  roomId: values.roomId,
  memberId: values.memberId,
  startsAt: zonedToUtcIso(values.date, values.startTime, timeZone),
  endsAt: zonedToUtcIso(values.date, values.endTime, timeZone),
  attendees: values.attendees,
  notes: values.notes || null,
});
