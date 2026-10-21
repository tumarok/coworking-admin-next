import { describe, expect, it } from 'vitest';
import type { Room } from '@/lib/contract/room';
import { roomInputSchema } from '@/lib/contract/room';
import {
  ROOM_FORM_DEFAULTS,
  ROOM_FORM_FIELDS,
  roomFormSchema,
  toFormValues,
  toRoomInput,
} from './schemas';

const ROOM: Room = {
  id: 'room_1',
  locationId: 'loc_1',
  locationName: 'Riverside Hub',
  name: 'Aurora',
  type: 'meeting_room',
  capacity: 12,
  hourlyRate: 3250,
  amenities: ['projector', 'phone'],
  status: 'maintenance',
};

const messages = (value: unknown) =>
  Object.fromEntries(
    (roomFormSchema.safeParse(value).error?.issues ?? []).map((issue) => [
      issue.path.join('.'),
      issue.message,
    ]),
  );

describe('toFormValues', () => {
  it('uses the defaults for a new room', () => {
    expect(toFormValues()).toEqual(ROOM_FORM_DEFAULTS);
    expect(ROOM_FORM_DEFAULTS).toMatchObject({ locationId: '', capacity: 6, hourlyRate: 25 });
  });

  it('takes the editable fields of an existing room, with the rate in euros', () => {
    expect(toFormValues(ROOM)).toEqual({
      locationId: 'loc_1',
      name: 'Aurora',
      type: 'meeting_room',
      capacity: 12,
      hourlyRate: 32.5,
      amenities: ['projector', 'phone'],
      status: 'maintenance',
    });
  });

  it('produces values the form schema accepts', () => {
    expect(roomFormSchema.safeParse(toFormValues(ROOM)).success).toBe(true);
  });
});

describe('toRoomInput', () => {
  it('turns euros into cents', () => {
    expect(toRoomInput({ ...toFormValues(ROOM), hourlyRate: 32.5 }).hourlyRate).toBe(3250);
    expect(toRoomInput({ ...toFormValues(ROOM), hourlyRate: 19.99 }).hourlyRate).toBe(1999);
  });

  it('round-trips a room to the body the API accepts', () => {
    const input = toRoomInput(toFormValues(ROOM));

    expect(input).toEqual({
      locationId: 'loc_1',
      name: 'Aurora',
      type: 'meeting_room',
      capacity: 12,
      hourlyRate: 3250,
      amenities: ['projector', 'phone'],
      status: 'maintenance',
    });
    expect(roomInputSchema.safeParse(input).success).toBe(true);
  });
});

describe('roomFormSchema', () => {
  const valid = toFormValues(ROOM);

  it('asks for a location, a name and a rate', () => {
    expect(messages({ ...valid, locationId: '', name: ' A ', hourlyRate: Number.NaN })).toEqual({
      locationId: 'Choose a location',
      name: 'At least 2 characters',
      hourlyRate: 'Enter a rate',
    });
  });

  it('keeps capacity between one seat and the limit', () => {
    expect(messages({ ...valid, capacity: 0 })).toEqual({ capacity: 'At least 1 seat' });
    expect(messages({ ...valid, capacity: 201 })).toEqual({ capacity: 'At most 200 seats' });
    expect(messages({ ...valid, capacity: Number.NaN })).toEqual({
      capacity: 'Enter the number of seats',
    });
    expect(messages({ ...valid, capacity: 2.5 })).toEqual({ capacity: 'Use a whole number' });
  });

  it('keeps the rate between zero and the limit', () => {
    expect(messages({ ...valid, hourlyRate: -0.01 })).toEqual({ hourlyRate: 'Cannot be negative' });
    expect(messages({ ...valid, hourlyRate: 10_000.01 })).toEqual({
      hourlyRate: 'At most €10,000.00',
    });
    expect(messages({ ...valid, hourlyRate: 0 })).toEqual({});
    expect(messages({ ...valid, hourlyRate: Number.NaN })).toEqual({ hourlyRate: 'Enter a rate' });
    expect(messages({ ...valid, hourlyRate: 10_000 })).toEqual({});
  });
});

describe('roomFormSchema: decimals', () => {
  const valid = toFormValues(ROOM);

  it.each([19.999, 1.005, 12.345])('refuses %s instead of rounding it', (hourlyRate) => {
    expect(messages({ ...valid, hourlyRate })).toEqual({ hourlyRate: 'At most 2 decimals' });
  });

  it.each([32.5, 19.99, 0.01, 4.35, 0.1 + 0.2])('accepts %s', (hourlyRate) => {
    expect(messages({ ...valid, hourlyRate })).toEqual({});
  });
});

describe('ROOM_FORM_FIELDS', () => {
  it('lists every field of the form', () => {
    expect(ROOM_FORM_FIELDS.toSorted()).toEqual(
      ['amenities', 'capacity', 'hourlyRate', 'locationId', 'name', 'status', 'type'].toSorted(),
    );
  });
});
