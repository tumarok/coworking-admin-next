import { describe, expect, it } from 'vitest';
import { locationKeys } from '@/features/locations/api/location-keys';
import { roomKeys } from '@/features/rooms/api/room-keys';
import { isLookupOf, lookupKey, QUERY_ROOTS } from './query-roots';

// A root typed wrongly in a key factory would silently skip the invalidations that use it.
// Add each new feature's key factory here.
const FACTORIES = {
  locations: locationKeys,
  rooms: roomKeys,
} satisfies Partial<Record<keyof typeof QUERY_ROOTS, { all: readonly unknown[] }>>;

describe('QUERY_ROOTS', () => {
  it.each(Object.entries(FACTORIES))('starts every key of %s with its root', (name, keys) => {
    const root = QUERY_ROOTS[name as keyof typeof FACTORIES];
    expect(keys.all).toEqual([root]);
    expect(keys.lists()[0]).toBe(root);
    expect(keys.list({ page: 1 })[0]).toBe(root);
    expect(keys.details()[0]).toBe(root);
    expect(keys.detail('id')[0]).toBe(root);
  });

  it('uses each root name once', () => {
    const values = Object.values(QUERY_ROOTS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('lookupKey', () => {
  it('starts with the root of the feature that keeps the lookup', () => {
    expect(lookupKey(QUERY_ROOTS.rooms, QUERY_ROOTS.locations, 'loc_1')).toEqual([
      'rooms',
      'lookup',
      'locations',
      'loc_1',
    ]);
  });

  it('is matched by `isLookupOf` for its record only, whichever feature keeps it', () => {
    const matches = isLookupOf(QUERY_ROOTS.locations, 'loc_1');

    expect(
      matches({ queryKey: lookupKey(QUERY_ROOTS.rooms, QUERY_ROOTS.locations, 'loc_1') }),
    ).toBe(true);
    expect(
      matches({ queryKey: lookupKey(QUERY_ROOTS.members, QUERY_ROOTS.locations, 'loc_1') }),
    ).toBe(true);
    expect(
      matches({ queryKey: lookupKey(QUERY_ROOTS.rooms, QUERY_ROOTS.locations, 'loc_2') }),
    ).toBe(false);
    expect(matches({ queryKey: lookupKey(QUERY_ROOTS.rooms, QUERY_ROOTS.members, 'loc_1') })).toBe(
      false,
    );
    expect(matches({ queryKey: ['locations', 'detail', 'loc_1'] })).toBe(false);
  });
});
