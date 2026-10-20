import { describe, expect, it } from 'vitest';
import { humanize } from './humanize';

describe('humanize', () => {
  it.each([
    ['pending', 'Pending'],
    ['checked_in', 'Checked in'],
    ['hot_desk', 'Hot desk'],
    ['', ''],
  ])('turns %j into %j', (value, expected) => {
    expect(humanize(value)).toBe(expected);
  });
});
