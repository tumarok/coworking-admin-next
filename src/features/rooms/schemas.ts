import * as z from 'zod';
import { centsToEuros, eurosToCents, formatMoney, isWholeCents } from '@/lib/money';
import {
  MAX_CAPACITY,
  MAX_HOURLY_RATE_CENTS,
  roomInputSchema,
  type Room,
  type RoomInput,
} from '@/lib/contract/room';

/**
 * The form edits the rate in euros, the API stores cents. Everything else follows the contract, so
 * both sides agree on the rules; the messages of a blank number field are the form's own.
 */
export const roomFormSchema = roomInputSchema.extend({
  locationId: z.string().min(1, { error: 'Choose a location' }),
  capacity: z
    .number({ error: 'Enter the number of seats' })
    .int({ error: 'Use a whole number' })
    .min(1, { error: 'At least 1 seat' })
    .max(MAX_CAPACITY, { error: `At most ${MAX_CAPACITY} seats` }),
  hourlyRate: z
    .number({ error: 'Enter a rate' })
    .min(0, { error: 'Cannot be negative' })
    .max(centsToEuros(MAX_HOURLY_RATE_CENTS), {
      error: `At most ${formatMoney(MAX_HOURLY_RATE_CENTS)}`,
    })
    // Rounding a typed 12.345 to a price would change what the user wrote without telling them.
    .refine(isWholeCents, { error: 'At most 2 decimals' }),
});

export type RoomFormValues = z.infer<typeof roomFormSchema>;

export const ROOM_FORM_DEFAULTS: RoomFormValues = {
  locationId: '',
  name: '',
  type: 'meeting_room',
  capacity: 6,
  hourlyRate: 25,
  amenities: [],
  status: 'available',
};

/** Field names a 422 can point at. */
export const ROOM_FORM_FIELDS = Object.keys(ROOM_FORM_DEFAULTS) as Array<keyof RoomFormValues>;

/** Form values of a room being edited (rate in euros); defaults for a new one. */
export const toFormValues = (room?: Room): RoomFormValues =>
  room
    ? {
        locationId: room.locationId,
        name: room.name,
        type: room.type,
        capacity: room.capacity,
        hourlyRate: centsToEuros(room.hourlyRate),
        amenities: room.amenities,
        status: room.status,
      }
    : ROOM_FORM_DEFAULTS;

/** The request body for the values of the form: the rate goes back to whole cents. */
export const toRoomInput = (values: RoomFormValues): RoomInput => ({
  ...values,
  hourlyRate: eurosToCents(values.hourlyRate),
});
