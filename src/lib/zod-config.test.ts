import * as z from 'zod';
import { describe, expect, it } from 'vitest';
import './zod-config';

describe('zod config', () => {
  it('turns the JIT compiler off, which needs eval', () => {
    expect(z.config().jitless).toBe(true);
  });
});
