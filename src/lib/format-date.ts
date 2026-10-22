import { utcToZoned } from '@/lib/timezone';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `2026-10-14` -> `14 Oct 2026`. A calendar date has no time zone and no instant, so it is
 * formatted from its own digits: no `Date`, no `Intl`. The reader's zone cannot move it to another
 * day, and the same text comes out on the server and in the browser (ICU versions differ in month
 * abbreviations, for example `Sep` and `Sept`, which would break hydration).
 */
export const formatDate = (isoDate: string) => {
  const [year = '', month = '', day = ''] = isoDate.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
};

/**
 * `12 Oct 2026, 09:00`: an instant as the clock of `timeZone` shows it. The text is built from the
 * numeric parts of the zone's clock and `formatDate`, so it is the same on the server and in the
 * browser, whatever zone either runs in.
 */
export const formatDateTime = (iso: string, timeZone: string) => {
  const { date, time } = utcToZoned(iso, timeZone);
  return `${formatDate(date)}, ${time}`;
};

/**
 * `12 Oct 2026, 09:00–11:30` for a stay within one local day, `12 Oct 2026, 20:00 – 13 Oct 2026,
 * 02:00` for one that crosses midnight.
 */
export const formatTimeRange = (startsAt: string, endsAt: string, timeZone: string) => {
  const start = utcToZoned(startsAt, timeZone);
  const end = utcToZoned(endsAt, timeZone);
  return start.date === end.date
    ? `${formatDate(start.date)}, ${start.time}–${end.time}`
    : `${formatDateTime(startsAt, timeZone)} – ${formatDateTime(endsAt, timeZone)}`;
};

/** Hours between two instants, as a number (`1.5`). */
export const durationHours = (startsAt: string, endsAt: string) =>
  (Date.parse(endsAt) - Date.parse(startsAt)) / 3_600_000;

/** The zone shown for a time whose location is gone or not loaded. */
export const FALLBACK_ZONE = 'UTC';

/** `formatTimeRange` on the clock of `zone`; UTC, said so, if the zone is unknown. */
export const formatTimeRangeIn = (startsAt: string, endsAt: string, zone: string | undefined) =>
  zone
    ? formatTimeRange(startsAt, endsAt, zone)
    : `${formatTimeRange(startsAt, endsAt, FALLBACK_ZONE)} UTC`;

/** `formatDateTime` on the clock of `zone`; UTC, said so, if the zone is unknown. */
export const formatDateTimeIn = (iso: string, zone: string | undefined) =>
  zone ? formatDateTime(iso, zone) : `${formatDateTime(iso, FALLBACK_ZONE)} UTC`;

/** Today's calendar date in UTC, `2026-10-14`: the day the API means when no date is given. */
export const todayUtc = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
