import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Location } from '@/lib/contract/location';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { fetchAllLocations } from './all-locations';

/** Serves `total` locations from the API in pages of the size asked for, and records the pages. */
const serve = (template: Location, total: number) => {
  const all: Location[] = Array.from({ length: total }, (_, index) => ({
    ...template,
    id: `loc_many_${index}`,
  }));
  const pages: number[] = [];
  server.use(
    http.get('*/bff/locations', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const page = Number(params.get('page') ?? 1);
      const limit = Number(params.get('limit'));
      pages.push(page);
      return HttpResponse.json({
        items: all.slice((page - 1) * limit, page * limit),
        total,
        page,
        limit,
      });
    }),
  );
  return { all, pages };
};

const templateOf = (api: ReturnType<typeof installMockApi>) => {
  const template = api.db.locations[0];
  if (!template) throw new Error('the seed has no location');
  return { ...template, roomCount: 0 };
};

describe('fetchAllLocations', () => {
  it('reads a single page when every location fits on it', async () => {
    const api = installMockApi({ via: 'bff' });

    const page = await fetchAllLocations();

    expect(page.items.map((l) => l.id).toSorted()).toEqual(
      api.db.locations.map((l) => l.id).toSorted(),
    );
  });

  it('reads page after page until the total is covered', async () => {
    const { all, pages } = serve(templateOf(installMockApi({ via: 'bff' })), 230);

    const result = await fetchAllLocations();

    expect(pages).toEqual([1, 2, 3]);
    expect(result.items).toHaveLength(230);
    expect(result.items.map((l) => l.id)).toEqual(all.map((l) => l.id));
  });

  it('stops when a page comes back empty although the total says more', async () => {
    installMockApi({ via: 'bff' });
    const pages: number[] = [];
    server.use(
      http.get('*/bff/locations', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
        pages.push(page);
        return HttpResponse.json({ items: [], total: 500, page, limit: 100 });
      }),
    );

    const result = await fetchAllLocations();

    expect(pages).toEqual([1, 2]);
    expect(result.items).toEqual([]);
  });

  it('gives up after 20 pages however large the total claims to be', async () => {
    const template = templateOf(installMockApi({ via: 'bff' }));
    const pages: number[] = [];
    server.use(
      http.get('*/bff/locations', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
        pages.push(page);
        return HttpResponse.json({
          items: Array.from({ length: 100 }, (_, index) => ({
            ...template,
            id: `loc_${page}_${index}`,
          })),
          total: 1_000_000,
          page,
          limit: 100,
        });
      }),
    );

    const result = await fetchAllLocations();

    expect(pages).toHaveLength(20);
    expect(result.items).toHaveLength(2000);
  });

  it('fails when a page cannot be read', async () => {
    const template = templateOf(installMockApi({ via: 'bff' }));
    serve(template, 230);
    server.use(
      http.get('*/bff/locations', ({ request }) =>
        new URL(request.url).searchParams.get('page') === '2'
          ? HttpResponse.json({ message: 'down' }, { status: 503 })
          : undefined,
      ),
    );

    await expect(fetchAllLocations()).rejects.toThrow('down');
  });

  it('passes the abort signal on, so a screen that left stops the reading', async () => {
    installMockApi({ via: 'bff' });
    const controller = new AbortController();
    controller.abort();

    await expect(fetchAllLocations(controller.signal)).rejects.toThrow();
  });
});
