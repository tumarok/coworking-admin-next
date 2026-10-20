import { NextResponse } from 'next/server';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '@/config/session';
import { server } from '@/test/msw-server';

// `redirect` throws in Next; here it throws a value the tests can read. The cookie jar is a real
// response cookie store, so the attributes are the ones a browser would receive.
const { RedirectSignal, jar } = vi.hoisted(() => ({
  RedirectSignal: class extends Error {
    readonly url: string;
    constructor(url: string) {
      super(`redirect to ${url}`);
      this.url = url;
    }
  },
  jar: { current: undefined as unknown as { get(name: string): unknown } },
}));

vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(jar.current) }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

import { login, logout } from './actions';

const LOGIN_URL = 'http://backend.test/api/v1/auth/login';
const user = { id: 'usr_1', name: 'Alex', email: 'alex@coworking.test', role: 'admin' };
const credentials = { email: 'alex@coworking.test', password: 'secret123' };

const cookie = () =>
  jar.current.get(SESSION_COOKIE) as
    | { value: string; httpOnly: boolean; sameSite: string; path: string; secure: boolean }
    | undefined;

/** Runs an action and says what it did: returned a value or redirected. */
const run = async <T>(action: () => Promise<T>) => {
  try {
    return { result: await action() };
  } catch (error) {
    if (error instanceof RedirectSignal) return { redirectedTo: error.url };
    throw error;
  }
};

const upstream = (respond: () => Response) => {
  const seen: { body: unknown; headers: Headers }[] = [];
  server.use(
    http.post(LOGIN_URL, async ({ request }) => {
      seen.push({ body: await request.json(), headers: request.headers });
      return respond();
    }),
  );
  return seen;
};

beforeEach(() => {
  jar.current = new NextResponse().cookies;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('login', () => {
  it('sets an httpOnly session cookie with the API token and goes to the dashboard', async () => {
    const seen = upstream(() => HttpResponse.json({ token: 'tok-1', user }));

    const outcome = await run(() => login(credentials));

    expect(outcome).toEqual({ redirectedTo: '/' });
    expect(cookie()).toMatchObject({
      value: 'tok-1',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.body).toEqual(credentials);
    expect(seen[0]?.headers.get('authorization')).toBeNull();
  });

  it('returns to the page the visitor asked for', async () => {
    upstream(() => HttpResponse.json({ token: 'tok-1', user }));

    expect(await run(() => login(credentials, '/rooms?page=2'))).toEqual({
      redirectedTo: '/rooms?page=2',
    });
  });

  it.each([
    'https://evil.test/',
    '//evil.test',
    '/login',
    '/bff/rooms',
    '\\evil',
    undefined,
    ['/rooms'],
    { path: '/rooms' },
    42,
  ])('ignores the unsafe return target %s', async (from) => {
    upstream(() => HttpResponse.json({ token: 'tok-1', user }));

    expect(await run(() => login(credentials, from))).toEqual({ redirectedTo: '/' });
  });

  it('shows the message of the API when it refuses the credentials, and sets no cookie', async () => {
    upstream(() => HttpResponse.json({ message: 'Invalid email or password' }, { status: 401 }));

    const outcome = await run(() => login(credentials));

    expect(outcome).toEqual({ result: { ok: false, message: 'Invalid email or password' } });
    expect(cookie()).toBeUndefined();
  });

  it.each([
    ['not an email', { email: 'nope', password: 'x' }],
    ['no password', { email: 'alex@coworking.test', password: '' }],
    ['not an object', 'alex'],
    ['nothing', undefined],
  ])('rejects %s without calling the API', async (_name, input) => {
    const seen = upstream(() => HttpResponse.json({ token: 'tok-1', user }));

    const outcome = await run(() => login(input));

    expect(outcome).toEqual({
      result: { ok: false, message: 'Enter a valid email and your password.' },
    });
    expect(seen).toHaveLength(0);
    expect(cookie()).toBeUndefined();
  });

  it('does not show a gateway page or a crash text as a login error', async () => {
    upstream(() => new HttpResponse('<html>Bad gateway</html>', { status: 502 }));

    expect(await run(() => login(credentials))).toEqual({
      result: { ok: false, message: 'Signing in failed. Try again.' },
    });
  });

  it.each([
    ['a gateway 403 page', () => new HttpResponse('<html>Forbidden</html>', { status: 403 })],
    ['a 404 without a body', () => new HttpResponse(null, { status: 404 })],
    ['a 429 with plain text', () => new HttpResponse('slow down', { status: 429 })],
    ['JSON of another shape', () => HttpResponse.json({ error: 'nope' }, { status: 400 })],
    [
      'a redirect',
      () =>
        new HttpResponse(null, { status: 307, headers: { location: 'http://elsewhere.test/' } }),
    ],
  ])('uses a fixed text for %s', async (_name, respond) => {
    upstream(respond);

    expect(await run(() => login(credentials))).toEqual({
      result: { ok: false, message: 'Signing in failed. Try again.' },
    });
    expect(cookie()).toBeUndefined();
  });

  it('gives up on an API that does not answer in time', async () => {
    upstream(() => HttpResponse.json({ token: 'tok-1', user }));
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(AbortSignal.abort(new DOMException('timed out', 'TimeoutError')));

    expect(await run(() => login(credentials))).toEqual({
      result: { ok: false, message: 'Cannot reach the server. Try again in a moment.' },
    });
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(cookie()).toBeUndefined();
  });

  it('marks the cookie Secure when the environment asks for it', async () => {
    vi.stubEnv('COOKIE_SECURE', 'true');
    vi.resetModules();
    const { login: secureLogin } = await import('./actions');
    upstream(() => HttpResponse.json({ token: 'tok-1', user }));

    await run(() => secureLogin(credentials));

    expect(cookie()).toMatchObject({ value: 'tok-1', secure: true });
  });

  it('fails when the API is unreachable', async () => {
    upstream(() => HttpResponse.error());

    expect(await run(() => login(credentials))).toEqual({
      result: { ok: false, message: 'Cannot reach the server. Try again in a moment.' },
    });
    expect(cookie()).toBeUndefined();
  });

  it.each([
    ['an empty token', { token: '', user }],
    ['no user', { token: 'tok-1' }],
    ['not JSON', 'plain text'],
  ])('does not sign in on a success answer with %s', async (_name, body) => {
    upstream(() =>
      typeof body === 'string' ? new HttpResponse(body) : HttpResponse.json(body, { status: 200 }),
    );

    expect(await run(() => login(credentials))).toEqual({
      result: { ok: false, message: 'Signing in failed. Try again.' },
    });
    expect(cookie()).toBeUndefined();
  });
});

describe('logout', () => {
  it('clears the cookie with the attributes it was set with and goes to the login page', async () => {
    upstream(() => HttpResponse.json({ token: 'tok-1', user }));
    await run(() => login(credentials));

    const outcome = await run(() => logout());

    expect(outcome).toEqual({ redirectedTo: '/login' });
    expect(cookie()).toMatchObject({ value: '', httpOnly: true, path: '/', maxAge: 0 });
  });
});
