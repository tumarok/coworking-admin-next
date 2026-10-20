import { NextRequest } from 'next/server';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '@/config/session';
import { server } from '@/test/msw-server';
import { DELETE, GET, PATCH, POST, PUT } from './route';

const ORIGIN = 'http://localhost:3000';
const API = 'http://backend.test/api/v1';

interface Seen {
  method: string;
  url: string;
  headers: Headers;
  body: string;
}

/** Answers `path` on the API and records what arrived there. */
const upstream = (
  path: string,
  respond: () => Response = () => HttpResponse.json({ ok: true }),
) => {
  const seen: Seen[] = [];
  server.use(
    http.all(`${API}/${path}`, async ({ request }) => {
      seen.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: await request.text(),
      });
      return respond();
    }),
  );
  return seen;
};

type CallInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]> & { search?: string };

const call = (handler: typeof GET, path: string, { search = '', ...init }: CallInit = {}) => {
  const request = new NextRequest(`${ORIGIN}/bff/${path}${search}`, init);
  return handler(request, { params: Promise.resolve({ path: path.split('/') }) });
};

const sameOrigin = { origin: ORIGIN, host: 'localhost:3000' };

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('forwarding', () => {
  it('passes method, path, query and JSON body to the API', async () => {
    const seen = upstream('rooms/7');

    const response = await call(PATCH, 'rooms/7', {
      method: 'PATCH',
      search: '?a=1&a=2&q=caf%C3%A9',
      headers: { ...sameOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Blue' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      method: 'PATCH',
      url: `${API}/rooms/7?a=1&a=2&q=caf%C3%A9`,
      body: '{"name":"Blue"}',
    });
  });

  it.each([
    ['GET', GET, undefined],
    ['POST', POST, '{}'],
    ['PUT', PUT, '{}'],
    ['DELETE', DELETE, undefined],
  ])('supports %s', async (method, handler, body) => {
    const seen = upstream('things');

    await call(handler, 'things', {
      method,
      headers: sameOrigin,
      ...(body && { body }),
    });

    expect(seen[0]?.method).toBe(method);
  });

  it('keeps a 4xx from the API as it is', async () => {
    upstream('rooms/9', () => HttpResponse.json({ message: 'Room not found' }, { status: 404 }));

    const response = await call(GET, 'rooms/9');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'Room not found' });
  });

  it('passes an empty 204 through', async () => {
    upstream('rooms/9', () => new HttpResponse(null, { status: 204 }));

    const response = await call(DELETE, 'rooms/9', { method: 'DELETE', headers: sameOrigin });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('encodes path segments again', async () => {
    const seen = upstream('members/a%20b');

    await call(GET, 'members/a b');

    expect(seen[0]?.url).toBe(`${API}/members/a%20b`);
  });
});

describe('path safety', () => {
  it.each([['..'], ['.']])('refuses a "%s" segment before it reaches the API', async (segment) => {
    const seen = upstream('admin');

    const response = await call(GET, `rooms/${segment}/admin`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'Invalid path' });
    expect(seen).toHaveLength(0);
  });

  it('does not follow a redirect from the API', async () => {
    upstream('rooms', () => new Response(null, { status: 307, headers: { location: '/admin' } }));

    const response = await call(GET, 'rooms');

    expect(response.status).toBe(502);
    expect(response.headers.has('location')).toBe(false);
  });
});

describe('credentials', () => {
  it('sends the session cookie as a Bearer token and not as a cookie', async () => {
    const seen = upstream('locations');

    await call(GET, 'locations', { headers: { cookie: `${SESSION_COOKIE}=token-1; other=x` } });

    expect(seen[0]?.headers.get('authorization')).toBe('Bearer token-1');
    expect(seen[0]?.headers.get('cookie')).toBeNull();
  });

  it('sends no credential without a session', async () => {
    const seen = upstream('locations');

    await call(GET, 'locations');

    expect(seen[0]?.headers.get('authorization')).toBeNull();
  });

  it('clears the cookie when the API answers 401', async () => {
    upstream('locations', () =>
      HttpResponse.json({ message: 'Authentication required' }, { status: 401 }),
    );

    const response = await call(GET, 'locations', {
      headers: { cookie: `${SESSION_COOKIE}=stale` },
    });

    expect(response.status).toBe(401);
    expect(response.cookies.get(SESSION_COOKIE)).toMatchObject({
      value: '',
      maxAge: 0,
      httpOnly: true,
      path: '/',
    });
  });

  it('keeps the cookie on other errors', async () => {
    upstream('locations', () => HttpResponse.json({ message: 'Nope' }, { status: 403 }));

    const response = await call(GET, 'locations');

    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });
});

describe('headers', () => {
  it('forwards only content-type and accept to the API', async () => {
    const seen = upstream('rooms');

    await call(POST, 'rooms', {
      method: 'POST',
      headers: {
        ...sameOrigin,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-forwarded-for': 'forwarded-hop',
        'x-custom': 'secret',
      },
      body: '{}',
    });

    const headers = seen[0]?.headers;
    expect(headers?.get('content-type')).toBe('application/json');
    expect(headers?.get('accept')).toBe('application/json');
    expect(headers?.get('origin')).toBeNull();
    expect(headers?.get('x-forwarded-for')).toBeNull();
    expect(headers?.get('x-custom')).toBeNull();
  });

  it('returns only content and retry headers from the API', async () => {
    upstream(
      'export',
      () =>
        new HttpResponse('a,b', {
          headers: {
            'content-type': 'text/csv',
            'content-disposition': 'attachment; filename="rooms.csv"',
            'retry-after': '3',
            'set-cookie': 'api=1; Path=/',
            'access-control-allow-origin': '*',
            'x-powered-by': 'mock',
            'cache-control': 'public, max-age=60',
          },
        }),
    );

    const response = await call(GET, 'export');

    expect(response.headers.get('content-type')).toBe('text/csv');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="rooms.csv"');
    expect(response.headers.get('retry-after')).toBe('3');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('x-powered-by')).toBeNull();
  });

  it.each([
    ['a success', () => HttpResponse.json({}), 200],
    ['an API error', () => HttpResponse.json({ message: 'x' }, { status: 500 }), 500],
  ])('forbids caching of %s', async (_name, respond, status) => {
    upstream('rooms', respond);

    const response = await call(GET, 'rooms');

    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('same-origin check', () => {
  const post = (headers: Record<string, string>) =>
    call(POST, 'rooms', { method: 'POST', headers, body: '{}' });

  it.each([
    ['no Origin', { host: 'localhost:3000' }],
    ['a foreign Origin', { origin: 'https://evil.test', host: 'localhost:3000' }],
    ['an Origin that is not a URL', { origin: 'null', host: 'localhost:3000' }],
    ['a foreign forwarded host', { ...sameOrigin, 'x-forwarded-host': 'other.test' }],
  ])('rejects a change with %s', async (_name, headers) => {
    const seen = upstream('rooms');

    const response = await post(headers);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: 'Cross-origin request rejected' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(seen).toHaveLength(0);
  });

  it('accepts the forwarded host behind a reverse proxy', async () => {
    const seen = upstream('rooms');

    const response = await post({
      origin: 'https://admin.example.test',
      host: 'web:3000',
      'x-forwarded-host': 'admin.example.test, proxy.internal',
    });

    expect(response.status).toBe(200);
    expect(seen).toHaveLength(1);
  });

  it('does not ask reads for an Origin', async () => {
    upstream('rooms');

    expect((await call(GET, 'rooms')).status).toBe(200);
  });
});

describe('API failures', () => {
  it('answers 502 when the API cannot be reached', async () => {
    upstream('rooms', () => HttpResponse.error());

    const response = await call(GET, 'rooms');

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'The API is unavailable' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('answers 504 when the API takes too long', async () => {
    upstream('rooms');
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
      AbortSignal.abort(new DOMException('timed out', 'TimeoutError')),
    );

    const response = await call(GET, 'rooms');

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ message: 'The API took too long to respond' });
  });

  it('answers 499 when the browser has gone away', async () => {
    upstream('rooms');
    const controller = new AbortController();
    controller.abort();

    const response = await call(GET, 'rooms', { signal: controller.signal });

    expect(response.status).toBe(499);
  });
});

describe('access log', () => {
  it('writes one JSON line per request, without the query', async () => {
    upstream('rooms');

    await call(GET, 'rooms', { search: '?q=secret-search' });

    const log = vi.mocked(console.log);
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]?.[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(Object.keys(entry)).toEqual(['timestamp', 'method', 'path', 'status', 'ms']);
    expect(entry).toMatchObject({ method: 'GET', path: '/bff/rooms', status: 200 });
    expect(Number.isNaN(Date.parse(String(entry.timestamp)))).toBe(false);
    expect(typeof entry.ms).toBe('number');
    expect(line).not.toContain('secret-search');
  });

  it('names the kind of failure behind a 502, never its message', async () => {
    upstream('rooms', () => HttpResponse.error());

    await call(GET, 'rooms');

    const entry = JSON.parse(String(vi.mocked(console.log).mock.calls[0]?.[0])) as {
      status: number;
      error: string;
    };
    expect(entry).toMatchObject({ status: 502, error: 'TypeError' });
  });
});
