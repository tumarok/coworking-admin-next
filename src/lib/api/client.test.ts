import { http, HttpResponse } from 'msw';
import * as z from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw-server';

const itemSchema = z.object({ id: z.string(), name: z.string() });
const assign = vi.fn();

// Each test starts from a fresh module: the 401 guard is module state. Classes are loaded from the
// same fresh graph so that `instanceof` holds.
const load = async () => {
  vi.resetModules();
  return { ...(await import('./client')), ...(await import('@/lib/api/errors')) };
};

const stubLocation = (pathname: string, search = '') => {
  vi.stubGlobal('location', { pathname, search, assign });
};

beforeEach(() => {
  stubLocation('/rooms', '?page=2');
});

afterEach(() => {
  vi.unstubAllGlobals();
  assign.mockReset();
});

describe('toSearch', () => {
  it('builds a query string and leaves out empty values', async () => {
    const { toSearch } = await load();

    expect(toSearch({ page: 2, q: 'a b', status: '', type: null, flag: undefined, on: true })).toBe(
      '?page=2&q=a+b&on=true',
    );
  });

  it('returns an empty string when there is nothing to send', async () => {
    const { toSearch } = await load();

    expect(toSearch()).toBe('');
    expect(toSearch({ q: '' })).toBe('');
  });
});

describe('api', () => {
  it('reads JSON through the BFF and checks it against the schema', async () => {
    const seen: string[] = [];
    server.use(
      http.get('*/bff/items', ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json({ id: '1', name: 'Atrium' });
      }),
    );
    const { api } = await load();

    const item = await api.get('items', itemSchema, { query: { page: 2, q: '' } });

    expect(item).toEqual({ id: '1', name: 'Atrium' });
    expect(seen).toEqual(['?page=2']);
  });

  it('sends a JSON body with POST and PATCH', async () => {
    const seen: { method: string; type: string | null; body: unknown }[] = [];
    server.use(
      http.all('*/bff/items', async ({ request }) => {
        seen.push({
          method: request.method,
          type: request.headers.get('content-type'),
          body: await request.json(),
        });
        return HttpResponse.json({ id: '1', name: 'Atrium' });
      }),
    );
    const { api } = await load();

    await api.post('/items', itemSchema, { body: { name: 'Atrium' } });
    await api.patch('items', itemSchema, { body: { name: 'Loft' } });

    expect(seen).toEqual([
      { method: 'POST', type: 'application/json', body: { name: 'Atrium' } },
      { method: 'PATCH', type: 'application/json', body: { name: 'Loft' } },
    ]);
  });

  it('resolves a 204 answer of DELETE', async () => {
    server.use(http.delete('*/bff/items/1', () => new HttpResponse(null, { status: 204 })));
    const { api } = await load();

    await expect(api.delete('items/1')).resolves.toBeUndefined();
  });

  it('turns an error body into an ApiError with its field errors and conflicts', async () => {
    const conflicts = [
      { id: 'b1', startsAt: '2026-10-14T09:00:00.000Z', endsAt: '2026-10-14T10:00:00.000Z' },
    ];
    server.use(
      http.post('*/bff/items', () =>
        HttpResponse.json(
          { message: 'Invalid', fieldErrors: { name: 'Required' }, conflicts },
          { status: 422 },
        ),
      ),
    );
    const { api, ApiError } = await load();

    const error = await api
      .post('items', itemSchema, { body: {} })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      message: 'Invalid',
      fieldErrors: { name: 'Required' },
      conflicts,
    });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    server.use(http.get('*/bff/items', () => new HttpResponse('<html>', { status: 500 })));
    const { api } = await load();

    await expect(api.get('items', itemSchema)).rejects.toMatchObject({
      status: 500,
      message: 'The server failed to handle the request',
    });
  });

  it('rejects a response that does not match the contract', async () => {
    server.use(http.get('*/bff/items', () => HttpResponse.json({ id: 1 })));
    const { api } = await load();

    await expect(api.get('items', itemSchema)).rejects.toMatchObject({
      status: 502,
      message: 'The server sent an unexpected response',
    });
  });

  it('rejects a 200 answer that is not JSON', async () => {
    server.use(http.get('*/bff/items', () => new HttpResponse('nope')));
    const { api } = await load();

    await expect(api.get('items', itemSchema)).rejects.toMatchObject({ status: 502 });
  });

  it('reports an unreachable server as status 0', async () => {
    server.use(http.get('*/bff/items', () => HttpResponse.error()));
    const { api } = await load();

    await expect(api.get('items', itemSchema)).rejects.toMatchObject({
      status: 0,
      message: 'Cannot reach the server. Check your connection.',
    });
  });

  it('lets an abort through as it is', async () => {
    server.use(http.get('*/bff/items', () => HttpResponse.json({ id: '1', name: 'x' })));
    const { api, ApiError } = await load();
    const controller = new AbortController();
    controller.abort();

    const error = await api
      .get('items', itemSchema, { signal: controller.signal })
      .catch((cause: unknown) => cause);

    expect(error).not.toBeInstanceOf(ApiError);
  });
});

describe('401 handling', () => {
  const unauthorized = () => {
    server.use(
      http.get('*/bff/items', () =>
        HttpResponse.json({ message: 'Authentication required' }, { status: 401 }),
      ),
    );
  };

  it('clears the cache and goes to the login page once, however many requests fail', async () => {
    unauthorized();
    const { api } = await load();
    const { getQueryClient } = await import('@/lib/query-client');
    const clear = vi.spyOn(getQueryClient(), 'clear');

    const results = await Promise.allSettled([
      api.get('items', itemSchema),
      api.get('items', itemSchema),
      api.get('items', itemSchema),
    ]);

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/login?from=%2Frooms%3Fpage%3D2');
  });

  it('single-flights a 401 that answers a mutation as well', async () => {
    server.use(
      http.post('*/bff/items', () => HttpResponse.json({ message: 'Expired' }, { status: 401 })),
    );
    const { api } = await load();

    const results = await Promise.allSettled([
      api.post('items', itemSchema, { body: { name: 'a' } }),
      api.post('items', itemSchema, { body: { name: 'b' } }),
    ]);

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('handles a 401 again after the page comes back from the back/forward cache', async () => {
    unauthorized();
    const { api } = await load();
    await api.get('items', itemSchema).catch(() => undefined);
    await api.get('items', itemSchema).catch(() => undefined);
    expect(assign).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    await api.get('items', itemSchema).catch(() => undefined);
    expect(assign).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await api.get('items', itemSchema).catch(() => undefined);
    expect(assign).toHaveBeenCalledTimes(2);
  });

  it('leaves out `from` on the dashboard', async () => {
    stubLocation('/');
    unauthorized();
    const { api } = await load();

    await api.get('items', itemSchema).catch(() => undefined);

    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('does nothing on the login page itself', async () => {
    stubLocation('/login');
    unauthorized();
    const { api } = await load();

    await expect(api.get('items', itemSchema)).rejects.toMatchObject({ status: 401 });

    expect(assign).not.toHaveBeenCalled();
  });
});
