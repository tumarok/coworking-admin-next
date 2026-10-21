import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUERY_ROOTS } from '@/config/query-roots';
import { ApiError } from '@/lib/api/errors';
import { bookable } from '@/test/bookable';
import { installMockApi } from '@/test/mock-api';
import { seededBookings } from '@/test/mock-bookings';
import { server } from '@/test/msw-server';
import { renderHookWithProviders } from '@/test/render-with-providers';
import { bookingKeys } from './booking-keys';
import {
  useBulkBookings,
  useChangeBookingStatus,
  useCreateBooking,
  useUpdateBooking,
} from './booking-mutations';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Roots that were invalidated, in the order of the calls. */
const invalidatedRoots = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);

describe('useCreateBooking', () => {
  it('creates a pending booking and refreshes the feature and the dashboard', async () => {
    const api = installMockApi({ via: 'bff' });
    const { input, room } = bookable(api);
    const { result, queryClient } = renderHookWithProviders(() => useCreateBooking());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const created = await result.current.mutateAsync(input);

    expect(created).toMatchObject({
      status: 'pending',
      roomName: room.name,
      startsAt: input.startsAt,
    });
    expect(queryClient.getQueryData(bookingKeys.detail(created.id))).toEqual(created);
    expect(invalidatedRoots(spy)).toEqual([bookingKeys.all, [QUERY_ROOTS.dashboard]]);
  });

  it('keeps the conflicts of a refused booking for the form, and refreshes nothing', async () => {
    const api = installMockApi({ via: 'bff' });
    const { input } = bookable(api);
    const { result, queryClient } = renderHookWithProviders(() => useCreateBooking());
    const first = await result.current.mutateAsync(input);
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const refused = await result.current.mutateAsync(input).catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(ApiError);
    expect(refused).toMatchObject({
      status: 409,
      conflicts: [{ id: first.id, startsAt: input.startsAt, endsAt: input.endsAt }],
    });
    expect(spy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
  });

  it('keeps a 422 for the form', async () => {
    const api = installMockApi({ via: 'bff' });
    const { input, room } = bookable(api);
    const { result } = renderHookWithProviders(() => useCreateBooking());

    await expect(result.current.mutateAsync({ ...input, attendees: 99 })).rejects.toMatchObject({
      status: 422,
      fieldErrors: { attendees: `This room seats up to ${room.capacity}` },
    });
  });
});

describe('useUpdateBooking', () => {
  it('stores the answer as the detail and in the cached lists, then refreshes', async () => {
    const api = installMockApi({ via: 'bff' });
    const { pending } = seededBookings(api);
    const { input } = bookable(api);
    const { result, queryClient } = renderHookWithProviders(() => useUpdateBooking(pending.id));
    const listKey = bookingKeys.list({ page: 1, limit: 20 });
    queryClient.setQueryData(listKey, {
      items: [pending, { ...pending, id: 'bk_other', attendees: 77 }],
      total: 2,
      page: 1,
      limit: 20,
    });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const saved = await result.current.mutateAsync({ ...input, attendees: 3 });

    expect(saved).toMatchObject({ id: pending.id, attendees: 3, startsAt: input.startsAt });
    expect(queryClient.getQueryData(bookingKeys.detail(pending.id))).toEqual(saved);
    const page = queryClient.getQueryData<{ items: Array<{ id: string; attendees: number }> }>(
      listKey,
    );
    expect(page?.items.map((item) => [item.id, item.attendees])).toEqual([
      [pending.id, 3],
      ['bk_other', 77],
    ]);
    expect(invalidatedRoots(spy)).toEqual([bookingKeys.all, [QUERY_ROOTS.dashboard]]);
  });

  it('refuses to edit a booking that is over, with the message of the API', async () => {
    const api = installMockApi({ via: 'bff' });
    const { completed } = seededBookings(api);
    const { input } = bookable(api);
    const { result } = renderHookWithProviders(() => useUpdateBooking(completed.id));

    await expect(result.current.mutateAsync(input)).rejects.toMatchObject({
      status: 409,
      message: 'Only pending or confirmed bookings can be edited',
    });
  });
});

describe('useChangeBookingStatus', () => {
  it('moves the booking on and stores it where it is printed', async () => {
    const api = installMockApi({ via: 'bff' });
    const { pending } = seededBookings(api);
    const { result, queryClient } = renderHookWithProviders(() =>
      useChangeBookingStatus(pending.id),
    );
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const changed = await result.current.mutateAsync('confirmed');

    expect(changed).toMatchObject({ id: pending.id, status: 'confirmed' });
    expect(queryClient.getQueryData(bookingKeys.detail(pending.id))).toEqual(changed);
    expect(invalidatedRoots(spy)).toEqual([bookingKeys.all, [QUERY_ROOTS.dashboard]]);
  });

  it('keeps the refusal of a move the rules do not allow', async () => {
    const api = installMockApi({ via: 'bff' });
    const { cancelled } = seededBookings(api);
    const { result, queryClient } = renderHookWithProviders(() =>
      useChangeBookingStatus(cancelled.id),
    );
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await expect(result.current.mutateAsync('confirmed')).rejects.toMatchObject({
      status: 409,
      message: 'Cannot change status from cancelled to confirmed',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not refresh when the server fails', async () => {
    server.use(
      http.post('*/bff/bookings/:id/status', () =>
        HttpResponse.json({ message: 'The server failed' }, { status: 500 }),
      ),
    );
    const { result, queryClient } = renderHookWithProviders(() => useChangeBookingStatus('bk_1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await expect(result.current.mutateAsync('confirmed')).rejects.toMatchObject({ status: 500 });

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('useBulkBookings', () => {
  it('reports what changed and what was refused, and refreshes lists, pages and the dashboard', async () => {
    const api = installMockApi({ via: 'bff' });
    const { pending, confirmed } = seededBookings(api);
    const { result, queryClient } = renderHookWithProviders(() => useBulkBookings());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const outcome = await result.current.mutateAsync({
      ids: [pending.id, confirmed.id],
      action: 'confirm',
    });

    expect(outcome).toEqual({
      updated: [pending.id],
      failed: [{ id: confirmed.id, reason: 'Cannot confirm a booking that is confirmed' }],
    });
    expect(api.db.bookings.find((b) => b.id === pending.id)?.status).toBe('confirmed');
    // Not the whole root: the lists, the page of every named booking, and the dashboard.
    expect(invalidatedRoots(spy)).toEqual([
      bookingKeys.lists(),
      bookingKeys.detail(pending.id),
      bookingKeys.detail(confirmed.id),
      [QUERY_ROOTS.dashboard],
    ]);
  });

  it('refreshes the lists and the pages of refused bookings, but not the dashboard', async () => {
    const api = installMockApi({ via: 'bff' });
    const { cancelled } = seededBookings(api);
    const { result, queryClient } = renderHookWithProviders(() => useBulkBookings());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const outcome = await result.current.mutateAsync({ ids: [cancelled.id], action: 'confirm' });

    expect(outcome.updated).toEqual([]);
    expect(outcome.failed).toEqual([
      { id: cancelled.id, reason: 'Cannot confirm a booking that is cancelled' },
    ]);
    // A refusal says the screen was out of date; nothing changed, so the counts did not move.
    expect(invalidatedRoots(spy)).toEqual([bookingKeys.lists(), bookingKeys.detail(cancelled.id)]);
  });

  it('keeps a failed request for the screen to explain, and refreshes nothing', async () => {
    installMockApi({ via: 'bff' });
    server.use(
      http.post('*/bff/bookings/bulk', () =>
        HttpResponse.json({ message: 'The server failed' }, { status: 500 }),
      ),
    );
    const { result, queryClient } = renderHookWithProviders(() => useBulkBookings());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await expect(
      result.current.mutateAsync({ ids: ['bk_1'], action: 'cancel' }),
    ).rejects.toMatchObject({ status: 500, message: 'The server failed' });
    expect(spy).not.toHaveBeenCalled();
  });
});
