import { describe, expect, it } from 'vitest';
import { formatDate } from './format-date';

describe('formatDate', () => {
  it('prints a calendar date as day, short month and year', () => {
    expect(formatDate('2026-10-14')).toBe('14 Oct 2026');
    expect(formatDate('2025-01-03')).toBe('3 Jan 2025');
  });

  it('spells every month the same way on every platform', () => {
    const months = Array.from(
      { length: 12 },
      (_, index) => formatDate(`2026-${String(index + 1).padStart(2, '0')}-15`).split(' ')[1],
    );

    expect(months).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]);
  });

  it('keeps the first and the last day of a year on their own days', () => {
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
  });

  it('is plain text work, so a time zone cannot move the day', () => {
    // No Date is involved: the day in the text is the day in the output.
    expect(formatDate('2026-03-01')).toBe('1 Mar 2026');
    expect(formatDate('2026-02-28')).toBe('28 Feb 2026');
  });

  it('leaves a month it does not know as it was written', () => {
    expect(formatDate('2026-13-01')).toBe('1 13 2026');
  });
});
