const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A calendar day in UTC, `YYYY-MM-DD`, `days` from today (negative for the past). */
export function daysFromToday(days: number): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/** `2026-12-14` as the screens print a day: `14 Dec 2026`. */
export function printedDay(isoDay: string): string {
  const [year = '', month = '', day = ''] = isoDay.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** `HH:mm` on the wall clock of a time zone, for an instant. */
export function clockIn(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** The calendar day an instant falls on in a time zone, `YYYY-MM-DD`. */
export function zonedDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(iso));
}

/** A booking's time as the screens print it: `12 Oct 2026, 09:00–10:00` on the location's clock. */
export function printedRange(startsAt: string, endsAt: string, timeZone: string): string {
  const day = printedDay(zonedDay(startsAt, timeZone));
  return `${day}, ${clockIn(startsAt, timeZone)}–${clockIn(endsAt, timeZone)}`;
}
