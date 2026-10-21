import { QUERY_ROOTS } from '@/config/query-roots';
import type { ListQuery } from '@/lib/list-params';

/** Query keys of the locations feature. Everything starts with the root, so one call drops them all. */
export const locationKeys = {
  all: [QUERY_ROOTS.locations] as const,
  lists: () => [QUERY_ROOTS.locations, 'list'] as const,
  list: (query: ListQuery) => [QUERY_ROOTS.locations, 'list', query] as const,
  details: () => [QUERY_ROOTS.locations, 'detail'] as const,
  detail: (id: string) => [QUERY_ROOTS.locations, 'detail', id] as const,
};
