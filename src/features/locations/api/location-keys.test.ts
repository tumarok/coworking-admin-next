import { describe, expect, it } from 'vitest';
import { QUERY_ROOTS } from '@/config/query-roots';
import { locationKeys } from './location-keys';

describe('locationKeys', () => {
  it('starts every key with the root, so one call can drop the whole feature', () => {
    for (const key of [
      locationKeys.all,
      locationKeys.lists(),
      locationKeys.list({ page: 1 }),
      locationKeys.details(),
      locationKeys.detail('loc_1'),
    ]) {
      expect(key[0]).toBe(QUERY_ROOTS.locations);
    }
  });

  it('keeps lists and details apart', () => {
    expect(locationKeys.lists()).not.toEqual(locationKeys.details());
  });

  it('puts the query into a list key and the id into a detail key', () => {
    expect(locationKeys.list({ page: 2, q: 'kyiv' })).toEqual([
      'locations',
      'list',
      { page: 2, q: 'kyiv' },
    ]);
    expect(locationKeys.detail('loc_7')).toEqual(['locations', 'detail', 'loc_7']);
  });

  it('makes a list key a child of the lists key (invalidating the lists reaches every page)', () => {
    expect(locationKeys.list({ page: 3 }).slice(0, 2)).toEqual(locationKeys.lists());
  });
});
