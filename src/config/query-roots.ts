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
