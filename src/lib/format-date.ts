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
