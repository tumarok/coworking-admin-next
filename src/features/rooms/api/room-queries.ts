import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { locationPageSchema, locationSchema } from '@/lib/contract/location';
import { roomPageSchema, roomSchema } from '@/lib/contract/room';
import type { ListQuery } from '@/lib/list-params';
import { roomKeys } from '@/features/rooms/api/room-keys';

/** One page of rooms. The old page stays on screen while the next one loads. */
export const roomsQuery = (query: ListQuery) =>
  queryOptions({
    queryKey: roomKeys.list(query),
    queryFn: ({ signal }) => api.get('rooms', roomPageSchema, { query, signal }),
    placeholderData: keepPreviousData,
  });

/**
 * One room. The details page explains a failure itself, so no toast. `enabled: false` is for a
 * page that just deleted the record and must not ask for it again.
 */
export const roomQuery = (id: string, { enabled = true }: { enabled?: boolean } = {}) =>
  queryOptions({
    queryKey: roomKeys.detail(id),
    enabled,
    queryFn: ({ signal }) => api.get(`rooms/${encodeURIComponent(id)}`, roomSchema, { signal }),
    meta: { silent: true },
  });

const LOOKUP_SIZE = 20;

/** Locations whose name, city or address match the text, for the location drop-downs. */
export const locationOptionsQuery = (term: string) =>
  queryOptions({
    queryKey: roomKeys.locationOptions(term),
    queryFn: ({ signal }) =>
      api.get('locations', locationPageSchema, {
        query: { q: term, limit: LOOKUP_SIZE },
        signal,
      }),
    placeholderData: keepPreviousData,
    // The drop-down shows its own status line.
    meta: { silent: true },
  });

/** The location a drop-down holds, by id: names a choice the search page does not contain. */
export const locationOptionQuery = (id: string) =>
  queryOptions({
    queryKey: roomKeys.locationOption(id),
    queryFn: ({ signal }) =>
      api.get(`locations/${encodeURIComponent(id)}`, locationSchema, { signal }),
    meta: { silent: true },
  });
