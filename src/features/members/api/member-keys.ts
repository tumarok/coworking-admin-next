import { QUERY_ROOTS } from '@/config/query-roots';
import type { ListQuery } from '@/lib/list-params';

/** Query keys of the members feature. Everything starts with the root, so one call drops them all. */
export const memberKeys = {
  all: [QUERY_ROOTS.members] as const,
  lists: () => [QUERY_ROOTS.members, 'list'] as const,
  list: (query: ListQuery) => [QUERY_ROOTS.members, 'list', query] as const,
  details: () => [QUERY_ROOTS.members, 'detail'] as const,
  detail: (id: string) => [QUERY_ROOTS.members, 'detail', id] as const,
};
