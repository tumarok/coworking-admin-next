import { QUERY_ROOTS } from '@/config/query-roots';

/**
 * Query keys of the dashboard. Everything starts with the root: any change to bookings, rooms,
 * members or locations drops them all with one call, so the figures never go stale.
 */
export const dashboardKeys = {
  all: [QUERY_ROOTS.dashboard] as const,
  // `date` is empty for "the day the API calls today".
  overview: (date: string) => [QUERY_ROOTS.dashboard, 'overview', date] as const,
  // Every location: the upcoming bookings are printed on the clock of their location.
  locations: () => [QUERY_ROOTS.dashboard, 'locations'] as const,
};
