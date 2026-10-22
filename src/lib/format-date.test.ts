import { describe, expect, it } from 'vitest';
import {
  durationHours,
  formatDate,
  formatDateTime,
  formatDateTimeIn,
  formatTimeRange,
  formatTimeRangeIn,
  todayUtc,
} from './format-date';

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

describe('formatDateTime', () => {
  it('prints the instant on the clock of the given zone', () => {
    expect(formatDateTime('2026-10-14T06:00:00.000Z', 'Europe/Kyiv')).toBe('14 Oct 2026, 09:00');
    expect(formatDateTime('2026-10-14T06:00:00.000Z', 'Europe/Lisbon')).toBe('14 Oct 2026, 07:00');
  });

  it('moves to the next day when the zone is ahead', () => {
    expect(formatDateTime('2026-10-14T22:00:00.000Z', 'Europe/Kyiv')).toBe('15 Oct 2026, 01:00');
  });
});

describe('formatTimeRange', () => {
  it('prints one date and both times for a stay within a local day', () => {
    expect(
      formatTimeRange('2026-10-14T06:00:00.000Z', '2026-10-14T08:30:00.000Z', 'Europe/Kyiv'),
    ).toBe('14 Oct 2026, 09:00–11:30');
  });

  it('prints both dates for a stay across local midnight', () => {
    expect(
      formatTimeRange('2026-10-14T17:00:00.000Z', '2026-10-14T23:00:00.000Z', 'Europe/Kyiv'),
    ).toBe('14 Oct 2026, 20:00 – 15 Oct 2026, 02:00');
  });

  it('judges the day by the zone, not by UTC', () => {
    // Same UTC day, but 23:30 and 00:30 are on different days in Kyiv.
    expect(
      formatTimeRange('2026-10-14T20:30:00.000Z', '2026-10-14T21:30:00.000Z', 'Europe/Kyiv'),
    ).toBe('14 Oct 2026, 23:30 – 15 Oct 2026, 00:30');
  });
});

describe('durationHours', () => {
  it('counts hours, with a fraction', () => {
    expect(durationHours('2026-10-14T09:00:00.000Z', '2026-10-14T10:30:00.000Z')).toBe(1.5);
    expect(durationHours('2026-10-14T09:00:00.000Z', '2026-10-14T17:00:00.000Z')).toBe(8);
  });
});

describe('formatTimeRangeIn and formatDateTimeIn', () => {
  const start = '2026-07-01T06:00:00.000Z';
  const end = '2026-07-01T07:30:00.000Z';

  it('print on the clock of the zone', () => {
    expect(formatTimeRangeIn(start, end, 'Europe/Kyiv')).toBe('1 Jul 2026, 09:00–10:30');
    expect(formatDateTimeIn(start, 'Europe/Lisbon')).toBe('1 Jul 2026, 07:00');
  });

  it('fall back to UTC and say so when the zone is unknown', () => {
    expect(formatTimeRangeIn(start, end, undefined)).toBe('1 Jul 2026, 06:00–07:30 UTC');
    expect(formatDateTimeIn(start, undefined)).toBe('1 Jul 2026, 06:00 UTC');
  });
});

describe('todayUtc', () => {
  it('is the UTC calendar date of the instant, whatever zone the machine runs in', () => {
    expect(todayUtc(Date.parse('2026-10-14T23:59:59.000Z'))).toBe('2026-10-14');
    expect(todayUtc(Date.parse('2026-10-15T00:00:00.000Z'))).toBe('2026-10-15');
  });
});
