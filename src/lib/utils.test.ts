import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins class names and skips falsy values', () => {
    expect(cn('px-2', false, undefined, 'text-sm')).toBe('px-2 text-sm');
  });

  it('lets the last conflicting Tailwind class win', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});
