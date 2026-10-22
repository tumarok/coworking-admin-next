import { isoDateSchema } from '@/lib/contract/common';

/** A `?date=` the API accepts; anything else in a hand-edited URL counts as "today". */
export const isDateParam = (value: string) => isoDateSchema.safeParse(value).success;

/**
 * Whole percent of the bookable hours that are booked, 0 when there are none. A ratio such as the
 * API's `occupancyRate` is `occupancyPercent(rate, 1)`.
 */
export const occupancyPercent = (bookedHours: number, availableHours: number) =>
  availableHours > 0 ? Math.min(100, Math.round((bookedHours / availableHours) * 100)) : 0;

/** Width of a status bar, in percent of the longest one (all counts zero: no bar). */
export const barPercent = (count: number, max: number) => (count / Math.max(1, max)) * 100;
