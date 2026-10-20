import { describe, expect, it } from 'vitest';
import { getQueryClient } from './query-client';

describe('getQueryClient on the server', () => {
  it('returns a new client every time, so requests never share cached data', () => {
    expect(getQueryClient()).not.toBe(getQueryClient());
  });
});
