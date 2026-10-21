import { lookupKey, QUERY_ROOTS } from '@/config/query-roots';
import type { ListQuery } from '@/lib/list-params';

/** Query keys of the rooms feature. Everything starts with the root, so one call drops them all. */
export const roomKeys = {
  all: [QUERY_ROOTS.rooms] as const,
  lists: () => [QUERY_ROOTS.rooms, 'list'] as const,
  list: (query: ListQuery) => [QUERY_ROOTS.rooms, 'list', query] as const,
  details: () => [QUERY_ROOTS.rooms, 'detail'] as const,
  detail: (id: string) => [QUERY_ROOTS.rooms, 'detail', id] as const,
  // The location drop-down of the form and the filter. Under the rooms root on purpose: a change
  // of a location refreshes it together with the rooms that print the location's name, and the
  // by-id lookup is a `lookupKey`, so deleting the location drops it instead of refetching it.
  locationOptions: (term: string) => [QUERY_ROOTS.rooms, 'location-options', term] as const,
  locationOption: (id: string) => lookupKey(QUERY_ROOTS.rooms, QUERY_ROOTS.locations, id),
};
