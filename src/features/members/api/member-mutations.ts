import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { isLookupOf, QUERY_ROOTS } from '@/config/query-roots';
import { api } from '@/lib/api/client';
import { memberSchema, type MemberInput } from '@/lib/contract/member';
import { replaceInLists } from '@/lib/query-cache';
import { memberKeys } from '@/features/members/api/member-keys';

// The dashboard counts active members.
const invalidateDashboard = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.dashboard] });
};

// Bookings print the name of their member and keep a drop-down of members: they go stale together
// with a member. Not awaited: the caller must not wait for refetches.
const invalidateBookings = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.bookings] });
};

// The forms and the confirm dialog show these errors themselves: `silent` turns the toast off.
const SILENT = { silent: true };

export const useCreateMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MemberInput) => api.post('members', memberSchema, { body: input }),
    meta: SILENT,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memberKeys.all });
      // Bookings keep their own drop-down of members: the new one must be found there.
      invalidateBookings(queryClient);
      invalidateDashboard(queryClient);
    },
  });
};

export const useUpdateMember = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MemberInput) =>
      api.patch(`members/${encodeURIComponent(id)}`, memberSchema, { body: input }),
    meta: SILENT,
    onSuccess: (member) => {
      queryClient.setQueryData(memberKeys.detail(id), member);
      replaceInLists(queryClient, { queryKey: memberKeys.lists() }, member);
      void queryClient.invalidateQueries({ queryKey: memberKeys.all });
      invalidateBookings(queryClient);
      invalidateDashboard(queryClient);
    },
  });
};

export const useDeleteMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`members/${encodeURIComponent(id)}`),
    meta: SILENT,
    onSuccess: (_result, id) => {
      // The record is gone: dropping it keeps a refetch of the details page from asking for it.
      queryClient.removeQueries({ queryKey: memberKeys.detail(id) });
      // So are the by-id lookups other features keep (a booking form naming its member).
      queryClient.removeQueries({ predicate: isLookupOf(QUERY_ROOTS.members, id) });
      void queryClient.invalidateQueries({ queryKey: memberKeys.all });
      invalidateBookings(queryClient);
      invalidateDashboard(queryClient);
    },
  });
};
