import { describe, expect, it } from 'vitest';
import { isLookupOf, QUERY_ROOTS } from '@/config/query-roots';
import { bookingKeys } from './booking-keys';

describe('bookingKeys', () => {
  it('starts every key with the root, so one call can drop the whole feature', () => {
    for (const key of [
      bookingKeys.all,
      bookingKeys.lists(),
      bookingKeys.list({ page: 1 }),
      bookingKeys.details(),
      bookingKeys.detail('bk_1'),
      bookingKeys.locations(),
      bookingKeys.roomOptions('atr', true),
      bookingKeys.roomOption('room_1'),
      bookingKeys.memberOptions('ada', false),
      bookingKeys.memberOption('mem_1'),
    ]) {
      expect(key[0]).toBe(QUERY_ROOTS.bookings);
    }
  });

  it('makes a list key a child of the lists key (invalidating the lists reaches every page)', () => {
    expect(bookingKeys.list({ page: 3 }).slice(0, 2)).toEqual(bookingKeys.lists());
    expect(bookingKeys.lists()).not.toEqual(bookingKeys.details());
  });

  it('tells the drop-downs of the form from those of the filters', () => {
    expect(bookingKeys.roomOptions('atr', true)).not.toEqual(bookingKeys.roomOptions('atr', false));
    expect(bookingKeys.memberOptions('ada', true)).not.toEqual(
      bookingKeys.memberOptions('ada', false),
    );
  });

  it('marks the by-id room and member lookups, so their owners can drop them', () => {
    expect(
      isLookupOf(QUERY_ROOTS.rooms, 'room_1')({ queryKey: bookingKeys.roomOption('room_1') }),
    ).toBe(true);
    expect(
      isLookupOf(QUERY_ROOTS.members, 'mem_1')({ queryKey: bookingKeys.memberOption('mem_1') }),
    ).toBe(true);
    expect(
      isLookupOf(QUERY_ROOTS.rooms, 'room_2')({ queryKey: bookingKeys.roomOption('room_1') }),
    ).toBe(false);
    expect(
      isLookupOf(
        QUERY_ROOTS.rooms,
        'room_1',
      )({ queryKey: bookingKeys.roomOptions('room_1', true) }),
    ).toBe(false);
  });
});
