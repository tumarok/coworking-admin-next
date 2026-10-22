import { describe, expect, it } from 'vitest';
import { barPercent, isDateParam, occupancyPercent } from './constants';

describe('isDateParam', () => {
  it('accepts a calendar date and nothing else', () => {
    expect(isDateParam('2026-10-14')).toBe(true);
    expect(isDateParam('2028-02-29')).toBe(true);
    expect(isDateParam('')).toBe(false);
    expect(isDateParam('2026-02-30')).toBe(false);
    expect(isDateParam('14/10/2026')).toBe(false);
    expect(isDateParam('2026-10-14T09:00:00Z')).toBe(false);
  });
});

describe('occupancyPercent', () => {
  it('rounds booked over available hours to whole percent', () => {
    expect(occupancyPercent(7.5, 30)).toBe(25);
    expect(occupancyPercent(1, 3)).toBe(33);
    expect(occupancyPercent(2, 3)).toBe(67);
  });

  it('is 0 when nothing can be booked, and never above 100', () => {
    expect(occupancyPercent(0, 0)).toBe(0);
    expect(occupancyPercent(4, 0)).toBe(0);
    expect(occupancyPercent(12, 10)).toBe(100);
  });
});

describe('barPercent', () => {
  it('draws the longest bar in full and the others in proportion', () => {
    expect(barPercent(8, 8)).toBe(100);
    expect(barPercent(2, 8)).toBe(25);
    expect(barPercent(0, 8)).toBe(0);
  });

  it('draws no bar when every count is zero', () => {
    expect(barPercent(0, 0)).toBe(0);
  });
});
