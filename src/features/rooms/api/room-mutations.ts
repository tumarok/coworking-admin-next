import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { QUERY_ROOTS } from '@/config/query-roots';
import { api } from '@/lib/api/client';
import { roomSchema, type RoomInput } from '@/lib/contract/room';
import { replaceInLists } from '@/lib/query-cache';
import { roomKeys } from '@/features/rooms/api/room-keys';

// Locations count their rooms and the dashboard measures occupancy per room: both go stale when
// a room appears, moves or goes. Not awaited: the caller must not wait for refetches.
const invalidateCounts = (queryClient: QueryClient) => {
  for (const root of [QUERY_ROOTS.locations, QUERY_ROOTS.dashboard]) {
    void queryClient.invalidateQueries({ queryKey: [root] });
  }
};

// Bookings print the name, type and location of their room.
const invalidateBookings = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.bookings] });
};

// The forms and the confirm dialog show these errors themselves: `silent` turns the toast off.
const SILENT = { silent: true };

export const useCreateRoom = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomInput) => api.post('rooms', roomSchema, { body: input }),
    meta: SILENT,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roomKeys.all });
      invalidateCounts(queryClient);
    },
  });
};

export const useUpdateRoom = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomInput) =>
      api.patch(`rooms/${encodeURIComponent(id)}`, roomSchema, { body: input }),
    meta: SILENT,
    onSuccess: (room) => {
      queryClient.setQueryData(roomKeys.detail(id), room);
      replaceInLists(queryClient, { queryKey: roomKeys.lists() }, room);
      void queryClient.invalidateQueries({ queryKey: roomKeys.all });
      invalidateCounts(queryClient);
      invalidateBookings(queryClient);
    },
  });
};

export const useDeleteRoom = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`rooms/${encodeURIComponent(id)}`),
    meta: SILENT,
    onSuccess: (_result, id) => {
      // The record is gone: dropping it keeps a refetch of the details page from asking for it.
      queryClient.removeQueries({ queryKey: roomKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: roomKeys.all });
      invalidateCounts(queryClient);
      invalidateBookings(queryClient);
    },
  });
};
