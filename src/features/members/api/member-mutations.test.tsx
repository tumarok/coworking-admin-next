import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupKey, QUERY_ROOTS } from '@/config/query-roots';
import { ApiError } from '@/lib/api/errors';
import type { MemberInput } from '@/lib/contract/member';
import { installMockApi } from '@/test/mock-api';
import { seededMembers } from '@/test/mock-members';
import { server } from '@/test/msw-server';
import { renderHookWithProviders } from '@/test/render-with-providers';
import { memberKeys } from './member-keys';
import { useCreateMember, useDeleteMember, useUpdateMember } from './member-mutations';

const INPUT: MemberInput = {
  firstName: 'Dana',
  lastName: 'Testova',
  email: 'dana.testova@example.com',
  phone: '+380 44 000 00 00',
  company: null,
  plan: 'team',
  status: 'active',
};

afterEach(() => {
  vi.restoreAllMocks();
});

/** Roots that were invalidated, in the order of the calls. */
const invalidatedRoots = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);

describe('useCreateMember', () => {
  it('creates the member and refreshes the feature, the booking drop-down that lists them and the dashboard', async () => {
    installMockApi({ via: 'bff' });
    const { result, queryClient } = renderHookWithProviders(() => useCreateMember());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const created = await result.current.mutateAsync(INPUT);

    expect(created).toMatchObject({ firstName: 'Dana', company: null, status: 'active' });
    expect(invalidatedRoots(spy)).toEqual([
      memberKeys.all,
      [QUERY_ROOTS.bookings],
      [QUERY_ROOTS.dashboard],
    ]);
  });

  it('keeps the error for the form instead of toasting it', async () => {
    installMockApi({ via: 'bff' });
    const { result } = renderHookWithProviders(() => useCreateMember());
    await result.current.mutateAsync(INPUT);

    await expect(result.current.mutateAsync(INPUT)).rejects.toMatchObject({
      status: 422,
      fieldErrors: { email: 'This email is already registered' },
    });
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
  });

  it('does not refresh anything when the API refuses', async () => {
    server.use(
      http.post('*/bff/members', () =>
        HttpResponse.json({ message: 'The server failed' }, { status: 500 }),
      ),
    );
    const { result, queryClient } = renderHookWithProviders(() => useCreateMember());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await expect(result.current.mutateAsync(INPUT)).rejects.toMatchObject({ status: 500 });

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('useUpdateMember', () => {
  it('stores the answer as the detail and refreshes everything that shows the member', async () => {
    const api = installMockApi({ via: 'bff' });
    const member = api.db.members[0];
    if (!member) throw new Error('seed lacks members');
    const { result, queryClient } = renderHookWithProviders(() => useUpdateMember(member.id));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ ...INPUT, firstName: 'Renamed' });

    expect(queryClient.getQueryData(memberKeys.detail(member.id))).toMatchObject({
      id: member.id,
      firstName: 'Renamed',
      email: 'dana.testova@example.com',
    });
    expect(invalidatedRoots(spy)).toEqual([
      memberKeys.all,
      [QUERY_ROOTS.bookings],
      [QUERY_ROOTS.dashboard],
    ]);
  });
});

describe('useUpdateMember: cached lists', () => {
  it('puts the saved member into the cached lists at once, before they are refetched', async () => {
    const api = installMockApi({ via: 'bff' });
    const member = api.db.members[0];
    if (!member) throw new Error('seed lacks members');
    const { result, queryClient } = renderHookWithProviders(() => useUpdateMember(member.id));
    const listKey = memberKeys.list({ page: 1, limit: 20 });
    queryClient.setQueryData(listKey, {
      items: [member, { ...member, id: 'mem_other', firstName: 'Untouched' }],
      total: 2,
      page: 1,
      limit: 20,
    });

    await result.current.mutateAsync({ ...INPUT, firstName: 'Renamed' });

    const page = queryClient.getQueryData<{ items: Array<{ firstName: string }> }>(listKey);
    expect(page?.items.map((item) => item.firstName)).toEqual(['Renamed', 'Untouched']);
  });
});

describe('useDeleteMember', () => {
  // Members of the seeded data: one the API refuses to delete (upcoming bookings), one it deletes.
  const seed = () => {
    const { booked, free } = seededMembers(installMockApi({ via: 'bff' }));
    return { BOOKED: booked.id, FREE: free.id };
  };

  it('forgets the detail and refreshes the feature and what shows its members', async () => {
    const { FREE } = seed();
    const { result, queryClient } = renderHookWithProviders(() => useDeleteMember());
    queryClient.setQueryData(memberKeys.detail(FREE), { id: FREE });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync(FREE);

    expect(queryClient.getQueryData(memberKeys.detail(FREE))).toBeUndefined();
    expect(invalidatedRoots(spy)).toEqual([
      memberKeys.all,
      [QUERY_ROOTS.bookings],
      [QUERY_ROOTS.dashboard],
    ]);
  });

  it('drops the by-id lookups other features keep of the member instead of refetching them', async () => {
    const { BOOKED, FREE } = seed();
    const { result, queryClient } = renderHookWithProviders(() => useDeleteMember());
    const gone = lookupKey(QUERY_ROOTS.bookings, QUERY_ROOTS.members, FREE);
    const otherMember = lookupKey(QUERY_ROOTS.bookings, QUERY_ROOTS.members, BOOKED);
    const otherEntity = lookupKey(QUERY_ROOTS.bookings, QUERY_ROOTS.rooms, FREE);
    for (const key of [gone, otherMember, otherEntity]) queryClient.setQueryData(key, { key });

    await result.current.mutateAsync(FREE);

    expect(queryClient.getQueryData(gone)).toBeUndefined();
    expect(queryClient.getQueryData(otherMember)).toBeDefined();
    expect(queryClient.getQueryData(otherEntity)).toBeDefined();
  });

  it('leaves the cache alone when the API refuses because of upcoming bookings', async () => {
    const { BOOKED } = seed();
    const { result, queryClient } = renderHookWithProviders(() => useDeleteMember());
    const lookup = lookupKey(QUERY_ROOTS.bookings, QUERY_ROOTS.members, BOOKED);
    queryClient.setQueryData(memberKeys.detail(BOOKED), { id: BOOKED });
    queryClient.setQueryData(lookup, { id: BOOKED });

    await expect(result.current.mutateAsync(BOOKED)).rejects.toMatchObject({
      status: 409,
      message: 'This member has upcoming bookings; cancel them first',
    });

    expect(queryClient.getQueryData(memberKeys.detail(BOOKED))).toEqual({ id: BOOKED });
    expect(queryClient.getQueryData(lookup)).toEqual({ id: BOOKED });
  });
});
