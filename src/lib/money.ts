/** The API keeps money as whole cents; the app shows and edits euros. */
const EURO = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' });

/** 1250 -> "€12.50". */
export const formatMoney = (cents: number) => EURO.format(cents / 100);

/** Cents of the API to euros of a form field. */
export const centsToEuros = (cents: number) => cents / 100;

/**
 * Euros of a form to the whole cents the API stores: 32.5 -> 3250. Rounds away float noise only;
 * a form refuses amounts with more than two decimals (`isWholeCents`) before they get here.
 */
export const eurosToCents = (euros: number) => Math.round(euros * 100);

/**
 * Whether euros are a whole number of cents. Compared with a tolerance: 0.1 + 0.2 is a clean
 * 30 cents, while 1.005 (100.49999999999999 cents) is not.
 */
export const isWholeCents = (euros: number) => {
  const cents = euros * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6;
};
