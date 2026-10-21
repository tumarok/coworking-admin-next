import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { QUERY_ROOTS } from '@/config/query-roots';
import { api } from '@/lib/api/client';
import { locationSchema, type LocationInput } from '@/lib/contract/location';
import { locationKeys } from '@/features/locations/api/location-keys';

// Rooms and bookings print the name and city of a location, the dashboard counts per location:
// they go stale together with it. Not awaited: the caller must not wait for refetches.
const invalidateDependents = (queryClient: QueryClient) => {
  for (const root of [QUERY_ROOTS.rooms, QUERY_ROOTS.bookings, QUERY_ROOTS.dashboard]) {
    void queryClient.invalidateQueries({ queryKey: [root] });
  }
};

// The forms and the confirm dialog show these errors themselves: `silent` turns the toast off.
const SILENT = { silent: true };

export const useCreateLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LocationInput) => api.post('locations', locationSchema, { body: input }),
    meta: SILENT,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: locationKeys.all });
      void queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.dashboard] });
    },
  });
};

export const useUpdateLocation = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LocationInput) =>
      api.patch(`locations/${encodeURIComponent(id)}`, locationSchema, { body: input }),
    meta: SILENT,
    onSuccess: (location) => {
      queryClient.setQueryData(locationKeys.detail(id), location);
      void queryClient.invalidateQueries({ queryKey: locationKeys.all });
      invalidateDependents(queryClient);
    },
  });
};

export const useDeleteLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`locations/${encodeURIComponent(id)}`),
    meta: SILENT,
    onSuccess: (_result, id) => {
      // The record is gone: dropping it keeps a refetch of the details page from asking for it.
      queryClient.removeQueries({ queryKey: locationKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: locationKeys.all });
      invalidateDependents(queryClient);
    },
  });
};
