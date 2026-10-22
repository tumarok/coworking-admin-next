import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { makeQueryClient } from '@/lib/query-client';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { dashboardQuery, locationZonesQuery } from './dashboard-queries';

/** Records the dashboard requests the API gets. */
const watch = () => {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get('*/bff/dashboard', ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return undefined;
    }),
  );
  return queries;
};

describe('dashboardQuery', () => {
  it("asks for the API's today when no day is given", async () => {
    installMockApi({ via: 'bff' });
    const queries = watch();

    const data = await makeQueryClient().query(dashboardQuery(''));

    expect(queries).toHaveLength(1);
    expect(queries[0]?.has('date')).toBe(false);
    expect(data.date).toBe('2026-10-14');
  });

  it('asks for the given day', async () => {
    installMockApi({ via: 'bff' });
    const queries = watch();

    const data = await makeQueryClient().query(dashboardQuery('2026-10-20'));

    expect(queries[0]?.get('date')).toBe('2026-10-20');
    expect(data.date).toBe('2026-10-20');
    expect(Object.keys(data.byStatus)).toHaveLength(6);
  });

  it('reports a failure to the screen, which explains it itself, not as a toast', () => {
    expect(dashboardQuery('').meta).toEqual({ silent: true });
  });

  it('keeps the previous figures as placeholder while the next day loads', () => {
    const previous = { date: 'old' };

    expect(dashboardQuery('2026-10-20').placeholderData).toEqual(expect.any(Function));
    expect(
      (dashboardQuery('2026-10-20').placeholderData as (p: unknown) => unknown)(previous),
    ).toBe(previous);
  });
});

describe('locationZonesQuery', () => {
  it('reads every location, with its time zone', async () => {
    const api = installMockApi({ via: 'bff' });

    const page = await makeQueryClient().query(locationZonesQuery());

    expect(page.items.map((l) => [l.id, l.timezone]).toSorted()).toEqual(
      api.db.locations.map((l) => [l.id, l.timezone]).toSorted(),
    );
  });

  it('is silent and not retried by every component that mounts', () => {
    const options = locationZonesQuery();

    expect(options.meta).toEqual({ silent: true });
    expect(options.retryOnMount).toBe(false);
  });

  it('fails like any request when the API does', async () => {
    installMockApi({ via: 'bff' });
    server.use(
      http.get('*/bff/locations', () => HttpResponse.json({ message: 'down' }, { status: 500 })),
    );

    await expect(makeQueryClient().query(locationZonesQuery())).rejects.toThrow('down');
  });
});
