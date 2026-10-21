import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupKey, QUERY_ROOTS } from '@/config/query-roots';
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
  it('creates the location and refreshes the feature, the room drop-down that lists it and the dashboard', async () => {
    installMockApi({ via: 'bff' });
    const { result, queryClient } = renderHookWithProviders(() => useCreateLocation());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const created = await result.current.mutateAsync(INPUT);

    expect(created).toMatchObject({ name: 'Garden Annex', roomCount: 0 });
    expect(invalidatedRoots(spy)).toEqual([
      locationKeys.all,
      [QUERY_ROOTS.rooms],
      [QUERY_ROOTS.dashboard],
    ]);
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

describe('useUpdateLocation: cached lists', () => {
  it('puts the saved location into the cached lists at once, before they are refetched', async () => {
    installMockApi({ via: 'bff' });
    const { result, queryClient } = renderHookWithProviders(() => useUpdateLocation('loc_1'));
    const listKey = locationKeys.list({ page: 1, limit: 20 });
    queryClient.setQueryData(listKey, {
      items: [
        { id: 'loc_1', name: 'Old' },
        { id: 'loc_other', name: 'Untouched' },
      ],
      total: 2,
      page: 1,
      limit: 20,
    });

    await result.current.mutateAsync({ ...INPUT, name: 'Renamed Hub' });

    const page = queryClient.getQueryData<{ items: Array<{ id: string; name: string }> }>(listKey);
    expect(page?.items.map((location) => location.name)).toEqual(['Renamed Hub', 'Untouched']);
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

  it('drops the by-id lookups other features keep of the location instead of refetching them', async () => {
    const api = installMockApi({ via: 'bff' });
    api.db.locations.push({ ...INPUT, id: 'loc_empty' });
    const { result, queryClient } = renderHookWithProviders(() => useDeleteLocation());
    const gone = lookupKey(QUERY_ROOTS.rooms, QUERY_ROOTS.locations, 'loc_empty');
    const otherLocation = lookupKey(QUERY_ROOTS.rooms, QUERY_ROOTS.locations, 'loc_1');
    const otherEntity = lookupKey(QUERY_ROOTS.rooms, QUERY_ROOTS.members, 'loc_empty');
    for (const key of [gone, otherLocation, otherEntity]) queryClient.setQueryData(key, { key });

    await result.current.mutateAsync('loc_empty');

    expect(queryClient.getQueryData(gone)).toBeUndefined();
    expect(queryClient.getQueryData(otherLocation)).toBeDefined();
    expect(queryClient.getQueryData(otherEntity)).toBeDefined();
  });

  it('keeps the lookups when the API refuses to delete', async () => {
    installMockApi({ via: 'bff' });
    const { result, queryClient } = renderHookWithProviders(() => useDeleteLocation());
    const key = lookupKey(QUERY_ROOTS.rooms, QUERY_ROOTS.locations, 'loc_1');
    queryClient.setQueryData(key, { id: 'loc_1' });

    await expect(result.current.mutateAsync('loc_1')).rejects.toMatchObject({ status: 409 });

    expect(queryClient.getQueryData(key)).toEqual({ id: 'loc_1' });
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
