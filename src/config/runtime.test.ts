import { describe, expect, it } from 'vitest';
import { IS_DEVELOPMENT } from './runtime';

describe('runtime', () => {
  it('is not development under test', () => {
    expect(IS_DEVELOPMENT).toBe(false);
  });
});
