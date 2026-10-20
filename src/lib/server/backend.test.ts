import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw-server';
import { backendFetch, backendUrl } from './backend';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backendUrl', () => {
  it('puts the API prefix between the origin and the path', () => {
    expect(backendUrl('locations')).toBe('http://backend.test/api/v1/locations');
  });

  it('tolerates a leading slash and appends the query', () => {
    expect(backendUrl('/rooms/1', '?a=b')).toBe('http://backend.test/api/v1/rooms/1?a=b');
  });
});

describe('backendFetch', () => {
  const capture = () => {
    const seen: { auth: string | null; url: string }[] = [];
    server.use(
      http.get('http://backend.test/api/v1/ping', ({ request }) => {
        seen.push({ auth: request.headers.get('authorization'), url: request.url });
        return HttpResponse.json({ ok: true });
      }),
    );
    return seen;
  };

  it('sends the session token as a Bearer credential', async () => {
    const seen = capture();

    await backendFetch('ping', { token: 'token-1', search: '?q=x' });

    expect(seen).toEqual([{ auth: 'Bearer token-1', url: 'http://backend.test/api/v1/ping?q=x' }]);
  });

  it('sends no credential without a token', async () => {
    const seen = capture();

    await backendFetch('ping');

    expect(seen[0]?.auth).toBeNull();
  });

  it('follows the abort signal of the caller', async () => {
    capture();
    const controller = new AbortController();
    controller.abort();

    await expect(backendFetch('ping', { signal: controller.signal })).rejects.toThrow();
  });

  it('returns a redirect instead of following it', async () => {
    server.use(
      http.get(
        'http://backend.test/api/v1/moved',
        () =>
          new HttpResponse(null, { status: 307, headers: { location: 'http://elsewhere.test/' } }),
      ),
    );

    const response = await backendFetch('moved');

    expect(response.status).toBe(307);
  });

  it('gives up after the timeout', async () => {
    capture();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
      AbortSignal.abort(new DOMException('timed out', 'TimeoutError')),
    );

    await expect(backendFetch('ping')).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
