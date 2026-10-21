import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUERY_ROOTS } from '@/config/query-roots';
import { ApiError } from '@/lib/api/errors';
import type { RoomInput } from '@/lib/contract/room';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderHookWithProviders } from '@/test/render-with-providers';
import { roomKeys } from './room-keys';
import { useCreateRoom, useDeleteRoom, useUpdateRoom } from './room-mutations';

const INPUT: RoomInput = {
  locationId: 'loc_1',
  name: 'Garden Annex',
  type: 'meeting_room',
  capacity: 8,
  hourlyRate: 3250,
  amenities: ['projector'],
  status: 'available',
};

afterEach(() => {
  vi.restoreAllMocks();
});

/** Roots that were invalidated, in the order of the calls. */
const invalidatedRoots = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);

describe('useCreateRoom', () => {
  it('creates the room and refreshes the feature, the locations that count rooms and the dashboard', async () => {
    installMockApi({ via: 'bff' });
    const { result, queryClient } = renderHookWithProviders(() => useCreateRoom());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const created = await result.current.mutateAsync(INPUT);

    expect(created).toMatchObject({
      name: 'Garden Annex',
      hourlyRate: 3250,
      locationName: 'Riverside Hub',
    });
    expect(invalidatedRoots(spy)).toEqual([
      roomKeys.all,
      [QUERY_ROOTS.locations],
      [QUERY_ROOTS.dashboard],
    ]);
  });

  it('keeps the error for the form instead of toasting it', async () => {
    server.use(
      http.post('*/bff/rooms', () =>
        HttpResponse.json(
          { message: 'Validation failed', fieldErrors: { locationId: 'Location not found' } },
          { status: 422 },
        ),
      ),
    );
    const { result } = renderHookWithProviders(() => useCreateRoom());

    await expect(result.current.mutateAsync(INPUT)).rejects.toMatchObject({
      status: 422,
      fieldErrors: { locationId: 'Location not found' },
    });
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
  });
});

describe('useUpdateRoom', () => {
  it('stores the answer as the detail and refreshes everything that shows the room', async () => {
    installMockApi({ via: 'bff' });
    const { result, queryClient } = renderHookWithProviders(() => useUpdateRoom('room_6'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ ...INPUT, name: 'Renamed' });

    expect(queryClient.getQueryData(roomKeys.detail('room_6'))).toMatchObject({
      id: 'room_6',
      name: 'Renamed',
    });
    expect(invalidatedRoots(spy)).toEqual([
      roomKeys.all,
      [QUERY_ROOTS.locations],
      [QUERY_ROOTS.dashboard],
      [QUERY_ROOTS.bookings],
    ]);
  });
});

describe('useDeleteRoom', () => {
  it('forgets the detail and refreshes the feature and what shows its rooms', async () => {
    installMockApi({ via: 'bff' });
    const { result, queryClient } = renderHookWithProviders(() => useDeleteRoom());
    queryClient.setQueryData(roomKeys.detail('room_e'), { id: 'room_e' });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('room_e');

    expect(queryClient.getQueryData(roomKeys.detail('room_e'))).toBeUndefined();
    expect(invalidatedRoots(spy)).toEqual([
      roomKeys.all,
      [QUERY_ROOTS.locations],
      [QUERY_ROOTS.dashboard],
      [QUERY_ROOTS.bookings],
    ]);
  });

  it('leaves the cache alone when the API refuses', async () => {
    installMockApi({ via: 'bff' });
    const { result, queryClient } = renderHookWithProviders(() => useDeleteRoom());
    queryClient.setQueryData(roomKeys.detail('room_6'), { id: 'room_6' });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await expect(result.current.mutateAsync('room_6')).rejects.toMatchObject({
      status: 409,
      message: 'This room has upcoming bookings; cancel them first',
    });

    expect(queryClient.getQueryData(roomKeys.detail('room_6'))).toEqual({ id: 'room_6' });
    expect(spy).not.toHaveBeenCalled();
  });
});
