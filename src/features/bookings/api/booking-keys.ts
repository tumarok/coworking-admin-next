import { lookupKey, QUERY_ROOTS } from '@/config/query-roots';
import type { ListQuery } from '@/lib/list-params';

/** Query keys of the bookings feature. Everything starts with the root, so one call drops them all. */
export const bookingKeys = {
  all: [QUERY_ROOTS.bookings] as const,
  lists: () => [QUERY_ROOTS.bookings, 'list'] as const,
  list: (query: ListQuery) => [QUERY_ROOTS.bookings, 'list', query] as const,
  details: () => [QUERY_ROOTS.bookings, 'detail'] as const,
  detail: (id: string) => [QUERY_ROOTS.bookings, 'detail', id] as const,
  // Every location: the filter, and the time zone each booking is printed in.
  locations: () => [QUERY_ROOTS.bookings, 'locations'] as const,
  // The room and member drop-downs of the form and the filters. `bookable` narrows the form's to
  // rooms that are available and members that are active. The by-id lookups are `lookupKey`s, so
  // the owner of the record drops them when it deletes the record.
  roomOptions: (term: string, bookable: boolean) =>
    [QUERY_ROOTS.bookings, 'room-options', term, bookable] as const,
  roomOption: (id: string) => lookupKey(QUERY_ROOTS.bookings, QUERY_ROOTS.rooms, id),
  memberOptions: (term: string, bookable: boolean) =>
    [QUERY_ROOTS.bookings, 'member-options', term, bookable] as const,
  memberOption: (id: string) => lookupKey(QUERY_ROOTS.bookings, QUERY_ROOTS.members, id),
};
