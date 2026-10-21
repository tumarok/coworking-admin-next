import { describe, expect, it } from 'vitest';
import { QUERY_ROOTS } from '@/config/query-roots';
import { isLookupOf } from '@/config/query-roots';
import { roomKeys } from './room-keys';

describe('roomKeys', () => {
  it('starts every key with the root, so one call can drop the whole feature', () => {
    for (const key of [
      roomKeys.all,
      roomKeys.lists(),
      roomKeys.list({ page: 1 }),
      roomKeys.details(),
      roomKeys.detail('room_1'),
      roomKeys.locationOptions('riv'),
      roomKeys.locationOption('loc_1'),
    ]) {
      expect(key[0]).toBe(QUERY_ROOTS.rooms);
    }
  });

  it('keeps lists and details apart', () => {
    expect(roomKeys.lists()).not.toEqual(roomKeys.details());
  });

  it('puts the query into a list key and the id into a detail key', () => {
    expect(roomKeys.list({ page: 2, locationId: 'loc_1' })).toEqual([
      'rooms',
      'list',
      { page: 2, locationId: 'loc_1' },
    ]);
    expect(roomKeys.detail('room_7')).toEqual(['rooms', 'detail', 'room_7']);
  });

  it('makes a list key a child of the lists key (invalidating the lists reaches every page)', () => {
    expect(roomKeys.list({ page: 3 }).slice(0, 2)).toEqual(roomKeys.lists());
  });

  it('marks the by-id location lookup, so the owner of the location can drop it', () => {
    expect(
      isLookupOf(QUERY_ROOTS.locations, 'loc_1')({ queryKey: roomKeys.locationOption('loc_1') }),
    ).toBe(true);
    expect(
      isLookupOf(QUERY_ROOTS.locations, 'loc_2')({ queryKey: roomKeys.locationOption('loc_1') }),
    ).toBe(false);
    expect(
      isLookupOf(QUERY_ROOTS.locations, 'loc_1')({ queryKey: roomKeys.locationOptions('loc_1') }),
    ).toBe(false);
    expect(isLookupOf(QUERY_ROOTS.locations, 'loc_1')({ queryKey: roomKeys.detail('loc_1') })).toBe(
      false,
    );
  });

  it('keeps the location lookups apart from the lists and the details', () => {
    expect(roomKeys.locationOptions('riv')).toEqual(['rooms', 'location-options', 'riv']);
    expect(roomKeys.locationOption('loc_1')).toEqual(['rooms', 'lookup', 'locations', 'loc_1']);
  });
});
