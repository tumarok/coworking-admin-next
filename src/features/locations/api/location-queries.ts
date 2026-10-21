import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { locationPageSchema, locationSchema } from '@/lib/contract/location';
import type { ListQuery } from '@/lib/list-params';
import { locationKeys } from '@/features/locations/api/location-keys';

/** One page of locations. The old page stays on screen while the next one loads. */
export const locationsQuery = (query: ListQuery) =>
  queryOptions({
    queryKey: locationKeys.list(query),
    queryFn: ({ signal }) => api.get('locations', locationPageSchema, { query, signal }),
    placeholderData: keepPreviousData,
  });

/**
 * One location. The details page explains a failure itself, so no toast. `enabled: false` is for
 * a page that just deleted the record and must not ask for it again.
 */
export const locationQuery = (id: string, { enabled = true }: { enabled?: boolean } = {}) =>
  queryOptions({
    queryKey: locationKeys.detail(id),
    enabled,
    queryFn: ({ signal }) =>
      api.get(`locations/${encodeURIComponent(id)}`, locationSchema, { signal }),
    meta: { silent: true },
  });
