import { humanize } from '@/lib/humanize';
import { LOCATION_STATUSES, TIMEZONES } from '@/lib/contract/location';

/** Statuses as filter and form options. */
export const STATUS_OPTIONS = LOCATION_STATUSES.map((value) => ({
  value,
  label: humanize(value),
}));

/** Time zones a location can be in: the contract allows exactly these. */
export const TIMEZONE_OPTIONS = TIMEZONES.map((value) => ({ value, label: value }));

/** Filter keys of the list, in the URL next to `page`, `limit` and `q`. */
export const FILTER_KEYS = ['status'] as const;

/** What each filter accepts; other values in the URL count as no filter. */
export const FILTER_VALUES = { status: LOCATION_STATUSES } as const;
