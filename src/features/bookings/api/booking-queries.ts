import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { bookingPageSchema, bookingSchema } from '@/lib/contract/booking';
import { MAX_PAGE_SIZE } from '@/lib/contract/common';
import { locationPageSchema } from '@/lib/contract/location';
import { memberPageSchema, memberSchema } from '@/lib/contract/member';
import { roomPageSchema, roomSchema } from '@/lib/contract/room';
import type { ListQuery } from '@/lib/list-params';
import { bookingKeys } from '@/features/bookings/api/booking-keys';

/** One page of bookings. The old page stays on screen while the next one loads. */
export const bookingsQuery = (query: ListQuery) =>
  queryOptions({
    queryKey: bookingKeys.list(query),
    queryFn: ({ signal }) => api.get('bookings', bookingPageSchema, { query, signal }),
    placeholderData: keepPreviousData,
  });

/**
 * One booking. The details page explains a failure itself, so no toast.
 */
export const bookingQuery = (id: string) =>
  queryOptions({
    queryKey: bookingKeys.detail(id),
    queryFn: ({ signal }) =>
      api.get(`bookings/${encodeURIComponent(id)}`, bookingSchema, { signal }),
    meta: { silent: true },
  });

/** More pages than this are not read: a safeguard against a server that never stops growing. */
const MAX_LOCATION_PAGES = 20;

/**
 * Every location: a booking carries no time zone, so its location's is looked up here, and the
 * location filter lists these. The API sends at most 100 per page, so the pages are read until
 * the total is covered. A failure is shown by the screens as a UTC fallback, not as a toast.
 */
export const locationsQuery = () =>
  queryOptions({
    queryKey: bookingKeys.locations(),
    queryFn: async ({ signal }) => {
      const first = await api.get('locations', locationPageSchema, {
        query: { limit: MAX_PAGE_SIZE },
        signal,
      });
      const items = [...first.items];
      for (let page = 2; items.length < first.total && page <= MAX_LOCATION_PAGES; page += 1) {
        const next = await api.get('locations', locationPageSchema, {
          query: { limit: MAX_PAGE_SIZE, page },
          signal,
        });
        if (next.items.length === 0) break;
        items.push(...next.items);
      }
      return { ...first, items };
    },
    meta: { silent: true },
    // Screens swap a placeholder for the page while this loads; a failed answer retried by every
    // component that mounts would flip them back and forth.
    retryOnMount: false,
  });

const LOOKUP_SIZE = 20;

const roomSearch = (term: string, bookable: boolean) =>
  queryOptions({
    queryKey: bookingKeys.roomOptions(term, bookable),
    queryFn: ({ signal }) =>
      api.get('rooms', roomPageSchema, {
        query: bookable
          ? { q: term, limit: LOOKUP_SIZE, status: 'available' }
          : { q: term, limit: LOOKUP_SIZE },
        signal,
      }),
    placeholderData: keepPreviousData,
    // The drop-down shows its own status line.
    meta: { silent: true },
  });

/** Rooms matching the text, for the room filter (every room). */
export const roomOptionsQuery = (term: string) => roomSearch(term, false);

/** Rooms matching the text that can be booked, for the form. */
export const bookableRoomOptionsQuery = (term: string) => roomSearch(term, true);

/** The room a drop-down or the form holds, by id: names a choice the search page does not contain. */
export const roomOptionQuery = (id: string) =>
  queryOptions({
    queryKey: bookingKeys.roomOption(id),
    queryFn: ({ signal }) => api.get(`rooms/${encodeURIComponent(id)}`, roomSchema, { signal }),
    meta: { silent: true },
  });

const memberSearch = (term: string, bookable: boolean) =>
  queryOptions({
    queryKey: bookingKeys.memberOptions(term, bookable),
    queryFn: ({ signal }) =>
      api.get('members', memberPageSchema, {
        query: bookable
          ? { q: term, limit: LOOKUP_SIZE, status: 'active' }
          : { q: term, limit: LOOKUP_SIZE },
        signal,
      }),
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });

/** Members matching the text, for the member filter (every member). */
export const memberOptionsQuery = (term: string) => memberSearch(term, false);

/** Members matching the text who can book, for the form. */
export const bookableMemberOptionsQuery = (term: string) => memberSearch(term, true);

/** The member a drop-down holds, by id. */
export const memberOptionQuery = (id: string) =>
  queryOptions({
    queryKey: bookingKeys.memberOption(id),
    queryFn: ({ signal }) => api.get(`members/${encodeURIComponent(id)}`, memberSchema, { signal }),
    meta: { silent: true },
  });
