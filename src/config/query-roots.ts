/**
 * First element of every query key of a feature. Features never import each other, so a feature
 * that changes data other screens show (a renamed location is printed in room and booking rows)
 * invalidates those screens by root instead of by importing their key factories.
 */
export const QUERY_ROOTS = {
  locations: 'locations',
  rooms: 'rooms',
  members: 'members',
  bookings: 'bookings',
  dashboard: 'dashboard',
} as const;

type QueryRoot = (typeof QUERY_ROOTS)[keyof typeof QUERY_ROOTS];

/**
 * Key of a lookup of one record of another feature (a room form naming its location):
 * `[own root, 'lookup', entity root, id]`. The shape is shared so the feature that owns the record
 * can drop these lookups when it deletes the record, without importing the feature that cached them.
 */
export const lookupKey = (root: QueryRoot, entity: QueryRoot, id: string) =>
  [root, 'lookup', entity, id] as const;

/** Matches every cached lookup of the record `id` of `entity`, whichever feature keeps it. */
export const isLookupOf =
  (entity: QueryRoot, id: string) => (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[1] === 'lookup' && query.queryKey[2] === entity && query.queryKey[3] === id;
