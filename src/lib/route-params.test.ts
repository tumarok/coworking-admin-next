import { describe, expect, it } from 'vitest';
import { isEntityId } from './route-params';

describe('isEntityId', () => {
  it.each(['loc_1', 'room-12', 'a'])('accepts %s', (id) => {
    expect(isEntityId(id)).toBe(true);
  });

  it.each(['', '..', 'a/b', 'a b', 'x?y', 'é', 'a'.repeat(65)])('rejects %j', (id) => {
    expect(isEntityId(id)).toBe(false);
  });
});
