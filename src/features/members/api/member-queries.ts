import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { memberPageSchema, memberSchema } from '@/lib/contract/member';
import type { ListQuery } from '@/lib/list-params';
import { memberKeys } from '@/features/members/api/member-keys';

/** One page of members. The old page stays on screen while the next one loads. */
export const membersQuery = (query: ListQuery) =>
  queryOptions({
    queryKey: memberKeys.list(query),
    queryFn: ({ signal }) => api.get('members', memberPageSchema, { query, signal }),
    placeholderData: keepPreviousData,
  });

/**
 * One member. The details page explains a failure itself, so no toast. `enabled: false` is for
 * a page that just deleted the record and must not ask for it again.
 */
export const memberQuery = (id: string, { enabled = true }: { enabled?: boolean } = {}) =>
  queryOptions({
    queryKey: memberKeys.detail(id),
    enabled,
    queryFn: ({ signal }) => api.get(`members/${encodeURIComponent(id)}`, memberSchema, { signal }),
    meta: { silent: true },
  });
