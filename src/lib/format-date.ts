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
