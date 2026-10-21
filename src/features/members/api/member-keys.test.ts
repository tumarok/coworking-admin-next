import { describe, expect, it } from 'vitest';
import { QUERY_ROOTS } from '@/config/query-roots';
import { memberKeys } from './member-keys';

describe('memberKeys', () => {
  it('starts every key with the root, so one call can drop the whole feature', () => {
    for (const key of [
      memberKeys.all,
      memberKeys.lists(),
      memberKeys.list({ page: 1 }),
      memberKeys.details(),
      memberKeys.detail('mem_1'),
    ]) {
      expect(key[0]).toBe(QUERY_ROOTS.members);
    }
  });

  it('keeps lists and details apart', () => {
    expect(memberKeys.lists()).not.toEqual(memberKeys.details());
  });

  it('puts the query into a list key and the id into a detail key', () => {
    expect(memberKeys.list({ page: 2, q: 'ada' })).toEqual([
      'members',
      'list',
      { page: 2, q: 'ada' },
    ]);
    expect(memberKeys.detail('mem_7')).toEqual(['members', 'detail', 'mem_7']);
  });

  it('makes a list key a child of the lists key (invalidating the lists reaches every page)', () => {
    expect(memberKeys.list({ page: 3 }).slice(0, 2)).toEqual(memberKeys.lists());
  });
});
