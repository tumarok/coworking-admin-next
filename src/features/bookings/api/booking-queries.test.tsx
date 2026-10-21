import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Location } from '@/lib/contract/location';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { makeQueryClient } from '@/lib/query-client';
import { locationsQuery } from './booking-queries';

describe('locationsQuery', () => {
  it('reads every location of the API on one page when they fit', async () => {
    const api = installMockApi({ via: 'bff' });

    const page = await makeQueryClient().query(locationsQuery());

    expect(page.items.map((l) => l.id).toSorted()).toEqual(
      api.db.locations.map((l) => l.id).toSorted(),
    );
  });

  it('reads the next pages until the total is covered', async () => {
    const api = installMockApi({ via: 'bff' });
    const template = api.db.locations[0];
    if (!template) throw new Error('seed lacks a location');
    const all: Location[] = Array.from({ length: 230 }, (_, index) => ({
      ...template,
      id: `loc_many_${index}`,
      roomCount: 0,
    }));
    const pages: string[] = [];
    server.use(
      http.get('*/bff/locations', ({ request }) => {
        const params = new URL(request.url).searchParams;
        const page = Number(params.get('page') ?? 1);
        const limit = Number(params.get('limit'));
        pages.push(`${page}/${limit}`);
        return HttpResponse.json({
          items: all.slice((page - 1) * limit, page * limit),
          total: all.length,
          page,
          limit,
        });
      }),
    );

    const result = await makeQueryClient().query(locationsQuery());

    expect(pages).toEqual(['1/100', '2/100', '3/100']);
    expect(result.items).toHaveLength(230);
    expect(result.items.at(-1)?.id).toBe('loc_many_229');
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

    const result = await makeQueryClient().query(locationsQuery());

    expect(result.items).toEqual([]);
    expect(pages).toEqual([1, 2]);
  });
});
