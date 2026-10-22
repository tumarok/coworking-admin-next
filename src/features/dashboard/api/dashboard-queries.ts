import { queryOptions } from '@tanstack/react-query';
import { fetchAllLocations } from '@/lib/api/all-locations';
import { api } from '@/lib/api/client';
import { dashboardSchema } from '@/lib/contract/dashboard';
import { dashboardKeys } from '@/features/dashboard/api/dashboard-keys';

/**
 * The figures of one UTC day (empty `date`: the API's today). The previous day's figures stay on
 * screen, dimmed, while the next day loads. The screen explains a failure itself, so no toast.
 */
export const dashboardQuery = (date: string) =>
  queryOptions({
    queryKey: dashboardKeys.overview(date),
    queryFn: ({ signal }) =>
      api.get('dashboard', dashboardSchema, { query: date ? { date } : undefined, signal }),
    placeholderData: (previous) => previous,
    meta: { silent: true },
  });

/**
 * Every location, for the time zone of an upcoming booking. A failure is shown as a UTC fallback,
 * not as a toast; a failed answer is not retried by every component that mounts.
 */
export const locationZonesQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.locations(),
    queryFn: ({ signal }) => fetchAllLocations(signal),
    meta: { silent: true },
    retryOnMount: false,
  });
