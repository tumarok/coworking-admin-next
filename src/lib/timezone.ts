/**
 * Wall-clock time in an IANA time zone, from `Intl` alone. A booking is typed as the local time of
 * its location and stored as a UTC instant; the zone of the browser or the server never takes part,
 * so the same text comes out wherever the code runs. Only numeric parts are read from `Intl`, which
 * ICU versions do not disagree on (month names are not used).
 */

export interface ZonedDateTime {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`. */
  time: string;
}

const MINUTE = 60_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string) => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
};

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** The clock of `timeZone` at the instant `ms`, as numbers. */
const wallClock = (ms: number, timeZone: string) => {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(ms)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    // Some engines print midnight as 24 even with `h23`.
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
  };
};

/** Offset of the zone from UTC at the instant `ms`, in milliseconds (east is positive). */
const zoneOffset = (ms: number, timeZone: string) => {
  const { year, month, day, hour, minute } = wallClock(ms, timeZone);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // The clock has no seconds: compare with the instant cut to the minute.
  return asUtc - Math.floor(ms / MINUTE) * MINUTE;
};

/**
 * `2026-07-01`, `09:00`, `Europe/Kyiv` -> `2026-07-01T06:00:00.000Z`. The offset is looked up
 * twice because the first guess may sit on the other side of a daylight-saving change. A local
 * time that does not exist (the hour skipped in spring) lands on the same minute an hour later;
 * one that happens twice (autumn) takes the later of the two. Neither throws.
 */
export const zonedToUtcIso = (date: string, time: string, timeZone: string) => {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  const first = asIfUtc - zoneOffset(asIfUtc, timeZone);
  const second = asIfUtc - zoneOffset(first, timeZone);
  return new Date(second).toISOString();
};

/** The date and time a clock in `timeZone` shows at the instant `iso`. */
export const utcToZoned = (iso: string, timeZone: string): ZonedDateTime => {
  const { year, month, day, hour, minute } = wallClock(Date.parse(iso), timeZone);
  return { date: `${pad(year, 4)}-${pad(month)}-${pad(day)}`, time: `${pad(hour)}:${pad(minute)}` };
};
