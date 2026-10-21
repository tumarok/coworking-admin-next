import { MEMBER_PLANS, MEMBER_STATUSES } from '@/lib/contract/member';
import { humanize } from '@/lib/humanize';

const toOptions = (values: readonly string[]) =>
  values.map((value) => ({ value, label: humanize(value) }));

/** Plans and statuses as filter and form options. */
export const PLAN_OPTIONS = toOptions(MEMBER_PLANS);
export const STATUS_OPTIONS = toOptions(MEMBER_STATUSES);

/** Filter keys of the list, in the URL next to `page`, `limit` and `q`. */
export const FILTER_KEYS = ['plan', 'status'] as const;

/** What each filter accepts; other values in the URL count as no filter. */
export const FILTER_VALUES = { plan: MEMBER_PLANS, status: MEMBER_STATUSES } as const;
