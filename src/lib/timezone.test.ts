import { describe, expect, it } from 'vitest';
import { utcToZoned, zonedToUtcIso } from './timezone';

describe('zonedToUtcIso', () => {
  it.each([
    ['2026-07-01', '09:00', 'Europe/Kyiv', '2026-07-01T06:00:00.000Z'],
    ['2026-01-15', '09:00', 'Europe/Kyiv', '2026-01-15T07:00:00.000Z'],
    ['2026-07-01', '09:00', 'Europe/Lisbon', '2026-07-01T08:00:00.000Z'],
    ['2026-01-15', '09:00', 'Europe/Lisbon', '2026-01-15T09:00:00.000Z'],
    ['2026-07-01', '09:00', 'Europe/London', '2026-07-01T08:00:00.000Z'],
    ['2026-07-01', '09:00', 'Europe/Warsaw', '2026-07-01T07:00:00.000Z'],
  ])('reads %s %s in %s as %s', (date, time, zone, expected) => {
    expect(zonedToUtcIso(date, time, zone)).toBe(expected);
  });

  it('uses the offset of the day, on both sides of the spring change in Berlin', () => {
    expect(zonedToUtcIso('2026-03-29', '01:30', 'Europe/Berlin')).toBe('2026-03-29T00:30:00.000Z');
    expect(zonedToUtcIso('2026-03-29', '10:00', 'Europe/Berlin')).toBe('2026-03-29T08:00:00.000Z');
  });

  it('puts a local time that does not exist an hour later instead of failing', () => {
    // 02:30 never happens in Berlin on 2026-03-29: the clocks jump from 02:00 to 03:00.
    const iso = zonedToUtcIso('2026-03-29', '02:30', 'Europe/Berlin');

    expect(iso).toBe('2026-03-29T01:30:00.000Z');
    expect(utcToZoned(iso, 'Europe/Berlin')).toEqual({ date: '2026-03-29', time: '03:30' });
  });

  it('takes the later of the two instants of a local time that happens twice', () => {
    // 02:30 happens twice in Berlin on 2026-10-25 (00:30Z and 01:30Z).
    expect(zonedToUtcIso('2026-10-25', '02:30', 'Europe/Berlin')).toBe('2026-10-25T01:30:00.000Z');
  });
});

describe('utcToZoned', () => {
  it('shows the clock of the zone', () => {
    expect(utcToZoned('2026-07-01T06:00:00.000Z', 'Europe/Kyiv')).toEqual({
      date: '2026-07-01',
      time: '09:00',
    });
    expect(utcToZoned('2026-01-15T07:00:00.000Z', 'Europe/Kyiv')).toEqual({
      date: '2026-01-15',
      time: '09:00',
    });
  });

  it('moves the date when the zone is already in the next day', () => {
    expect(utcToZoned('2026-07-01T22:30:00.000Z', 'Europe/Kyiv')).toEqual({
      date: '2026-07-02',
      time: '01:30',
    });
  });

  it('prints midnight as 00:00, not 24:00', () => {
    expect(utcToZoned('2026-07-01T21:00:00.000Z', 'Europe/Kyiv')).toEqual({
      date: '2026-07-02',
      time: '00:00',
    });
  });

  const quarterHours = Array.from({ length: 24 * 4 }, (_, index) => {
    const minutes = index * 15;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });

  it('round-trips every quarter hour of an ordinary day', () => {
    for (const time of quarterHours) {
      const iso = zonedToUtcIso('2026-03-28', time, 'Europe/Berlin');
      expect(utcToZoned(iso, 'Europe/Berlin')).toEqual({ date: '2026-03-28', time });
    }
  });

  it('round-trips the quarter hours of the day clocks go forward, except the skipped hour', () => {
    for (const time of quarterHours) {
      const iso = zonedToUtcIso('2026-03-29', time, 'Europe/Berlin');
      const skipped = time.startsWith('02:');
      const expected = skipped ? `03:${time.slice(3)}` : time;
      expect(utcToZoned(iso, 'Europe/Berlin')).toEqual({ date: '2026-03-29', time: expected });
    }
  });
});
