'use client';

import { parseAsInteger, parseAsString, useQueryStates, type Options } from 'nuqs';
import { PAGE_SIZES } from '@/config/pagination';
import { DEFAULT_PAGE_SIZE } from '@/lib/contract/common';

/** The URL is the source of truth for a list: reload, bookmark and back keep it. */
const URL_OPTIONS = {
  history: 'replace',
  shallow: true,
  clearOnDefault: true,
} satisfies Options;

/** Query a list endpoint takes: the page, its size, a search text and the non-empty filters. */
export type ListQuery = Record<string, string | number>;

const filterParsers = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, parseAsString.withDefault('')])) as Record<
    K,
    ReturnType<typeof parseAsString.withDefault>
  >;

/**
 * List state kept in the URL: `page`, `limit`, `q` and the given filter keys (all strings).
 * Any change other than the page itself (search, a filter, the page size) goes back to page 1.
 * `filterKeys` must be a constant, not a literal written in the render.
 */
export const useListParams = <K extends string = never>(filterKeys: readonly K[] = []) => {
  const [state, setState] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      limit: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
      q: parseAsString.withDefault(''),
      ...filterParsers(filterKeys),
    },
    URL_OPTIONS,
  );

  // The parsers are built from `filterKeys`, so TypeScript cannot follow their keys; this is the
  // loose view of what they produce and accept.
  const values = state as Record<string, string | number>;
  const write = setState as (patch: Record<string, string | number | null>) => unknown;
  const page = Math.max(1, Math.trunc(Number(values.page)) || 1);
  // Only the offered sizes: `limit=500` would be a 422 from the API, `limit=-5` makes no sense.
  const limit = (PAGE_SIZES as readonly number[]).includes(Number(values.limit))
    ? Number(values.limit)
    : DEFAULT_PAGE_SIZE;
  const q = String(values.q);
  const filters = Object.fromEntries(filterKeys.map((key) => [key, String(values[key])])) as Record<
    K,
    string
  >;

  const query: ListQuery = { page, limit };
  // The text stays as typed in `q` (a search box shows it); the request gets it trimmed.
  if (q.trim()) query.q = q.trim();
  for (const key of filterKeys) {
    if (filters[key]) query[key] = filters[key];
  }

  /** Writes a change; every change except one to `page` also resets the page. */
  const update = (patch: Record<string, string | number | null>) => write({ page: null, ...patch });

  return {
    page,
    limit,
    q,
    filters,
    /** Ready for a list request and for its query key. */
    query,
    setPage: (next: number) => write({ page: next }),
    setLimit: (next: number) => update({ limit: next }),
    setSearch: (text: string) => update({ q: text }),
    setFilter: (key: K, value: string | null) => update({ [key]: value }),
    /** Clears the search and every filter, keeps the page size. */
    reset: () => update({ q: null, ...Object.fromEntries(filterKeys.map((key) => [key, null])) }),
  };
};
