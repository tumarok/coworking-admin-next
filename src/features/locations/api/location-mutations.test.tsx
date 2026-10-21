import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUERY_ROOTS } from '@/config/query-roots';
import { ApiError } from '@/lib/api/errors';
import type { LocationInput } from '@/lib/contract/location';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderHookWithProviders } from '@/test/render-with-providers';
import { locationKeys } from './location-keys';
import { useCreateLocation, useDeleteLocation, useUpdateLocation } from './location-mutations';

const INPUT: LocationInput = {
  name: 'Garden Annex',
  city: 'Vienna',
  address: '5 Ring Strasse',
  timezone: 'Europe/Berlin',
  opensAt: '08:00',
  closesAt: '18:00',
  status: 'active',
};

afterEach(() => {
  vi.restoreAllMocks();
});

/** Roots that were invalidated, in the order of the calls. */
const invalidatedRoots = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);

describe('useCreateLocation', () => {
  it('creates the location and refreshes the feature and the dashboard', async () => {
    installMockApi({ via: 'bff' });
    const { result, queryClient } = renderHookWithProviders(() => useCreateLocation());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const created = await result.current.mutateAsync(INPUT);

    expect(created).toMatchObject({ name: 'Garden Annex', roomCount: 0 });
    expect(invalidatedRoots(spy)).toEqual([locationKeys.all, [QUERY_ROOTS.dashboard]]);
  });

  it('keeps the error for the form instead of toasting it', async () => {
    server.use(
      http.post('*/bff/locations', () =>
        HttpResponse.json(
          { message: 'Validation failed', fieldErrors: { name: 'Taken' } },
          { status: 422 },
        ),
      ),
    );
    const { result } = renderHookWithProviders(() => useCreateLocation());

    await expect(result.current.mutateAsync(INPUT)).rejects.toMatchObject({
      status: 422,
      fieldErrors: { name: 'Taken' },
    });
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
  });
});

describe('useUpdateLocation', () => {
  it('stores the answer as the detail and refreshes everything that shows the location', async () => {
    installMockApi({ via: 'bff' });
    const { result, queryClient } = renderHookWithProviders(() => useUpdateLocation('loc_1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ ...INPUT, name: 'Renamed Hub' });

    expect(queryClient.getQueryData(locationKeys.detail('loc_1'))).toMatchObject({
      id: 'loc_1',
      name: 'Renamed Hub',
    });
    expect(invalidatedRoots(spy)).toEqual([
      locationKeys.all,
      [QUERY_ROOTS.rooms],
      [QUERY_ROOTS.bookings],
      [QUERY_ROOTS.dashboard],
    ]);
  });
});

describe('useDeleteLocation', () => {
  it('forgets the detail and refreshes the feature and what shows its locations', async () => {
    const api = installMockApi({ via: 'bff' });
    api.db.locations.push({ ...INPUT, id: 'loc_empty' });
    const { result, queryClient } = renderHookWithProviders(() => useDeleteLocation());
    queryClient.setQueryData(locationKeys.detail('loc_empty'), { id: 'loc_empty' });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('loc_empty');

    expect(queryClient.getQueryData(locationKeys.detail('loc_empty'))).toBeUndefined();
    expect(invalidatedRoots(spy)).toEqual([
      locationKeys.all,
      [QUERY_ROOTS.rooms],
      [QUERY_ROOTS.bookings],
      [QUERY_ROOTS.dashboard],
    ]);
  });

  it('leaves the cache alone when the API refuses', async () => {
    installMockApi({ via: 'bff' });
    const { result, queryClient } = renderHookWithProviders(() => useDeleteLocation());
    queryClient.setQueryData(locationKeys.detail('loc_1'), { id: 'loc_1' });

    await expect(result.current.mutateAsync('loc_1')).rejects.toMatchObject({
      status: 409,
      message: 'Remove or move the rooms of this location first',
    });

    expect(queryClient.getQueryData(locationKeys.detail('loc_1'))).toEqual({ id: 'loc_1' });
  });
});
