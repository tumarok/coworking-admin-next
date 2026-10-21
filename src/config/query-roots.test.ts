import { describe, expect, it } from 'vitest';
import { locationKeys } from '@/features/locations/api/location-keys';
import { QUERY_ROOTS } from './query-roots';

// A root typed wrongly in a key factory would silently skip the invalidations that use it.
// Add each new feature's key factory here.
const FACTORIES = {
  locations: locationKeys,
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
