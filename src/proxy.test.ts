import { NextRequest } from 'next/server';
import { getRedirectUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '@/config/session';
import { config, proxy } from './proxy';

const ORIGIN = 'http://localhost:3000';

const visit = (
  path: string,
  {
    session = false,
    method = 'GET',
    headers = {},
  }: {
    session?: boolean;
    method?: string;
    headers?: Record<string, string>;
  } = {},
) =>
  proxy(
    new NextRequest(new URL(path, ORIGIN), {
      method,
      headers: { ...headers, ...(session && { cookie: `${SESSION_COOKIE}=token-1` }) },
    }),
  );

describe('matcher', () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url: `${ORIGIN}${url}` });

  it.each(['/', '/login', '/bookings', '/bookings/12', '/locations?page=2', '/some-missing-page'])(
    'runs on the page %s',
    (path) => {
      expect(matches(path)).toBe(true);
    },
  );

  it.each([
    '/_next/static/chunks/main.js',
    '/_next/image?url=%2Fa.png&w=64&q=75',
    '/favicon.ico',
    '/bff/bookings',
    '/bff',
    '/logo.svg',
    '/robots.txt',
    '/manifest.json',
  ])('skips %s', (path) => {
    expect(matches(path)).toBe(false);
  });

  it('does not treat a page that starts with bff as the BFF', () => {
    expect(matches('/bffoon')).toBe(true);
  });
});

describe('visitor without a session', () => {
  it('is sent to the login page, remembering where they were going', () => {
    const response = visit('/bookings?status=pending&page=2');

    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(
      `${ORIGIN}/login?from=${encodeURIComponent('/bookings?status=pending&page=2')}`,
    );
  });

  it('is sent to a clean login URL from the home page', () => {
    expect(getRedirectUrl(visit('/'))).toBe(`${ORIGIN}/login`);
  });

  it('does not carry the internal RSC token along', () => {
    const url = getRedirectUrl(visit('/rooms?_rsc=abc12&q=x'));

    expect(url).toBe(`${ORIGIN}/login?from=${encodeURIComponent('/rooms?q=x')}`);
  });

  it('may open the login page', () => {
    const response = visit('/login');

    expect(getRedirectUrl(response)).toBeNull();
  });

  it('treats an empty cookie as no session', () => {
    const response = proxy(
      new NextRequest(new URL('/rooms', ORIGIN), { headers: { cookie: `${SESSION_COOKIE}=` } }),
    );

    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/login?from=%2Frooms`);
  });
});

describe('visitor with a session', () => {
  it('opens protected pages', () => {
    expect(getRedirectUrl(visit('/bookings', { session: true }))).toBeNull();
  });

  it('is sent away from the login page to the page they came from', () => {
    const response = visit(`/login?from=${encodeURIComponent('/rooms?page=3')}`, { session: true });

    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/rooms?page=3`);
  });

  it.each(['https://evil.test', '//evil.test', '/login', undefined])(
    'goes home instead of following the unsafe target %s',
    (from) => {
      const path = from === undefined ? '/login' : `/login?from=${encodeURIComponent(from)}`;

      expect(getRedirectUrl(visit(path, { session: true }))).toBe(`${ORIGIN}/`);
    },
  );

  it('stays on the login page when the API rejected their cookie, so a stale cookie cannot loop', () => {
    const response = visit('/login?expired=1', { session: true });

    expect(getRedirectUrl(response)).toBeNull();
    expect(response.headers.get('content-security-policy')).toContain("'nonce-");
  });

  it('only honours expired=1, not any value', () => {
    expect(getRedirectUrl(visit('/login?expired=0', { session: true }))).toBe(`${ORIGIN}/`);
  });

  it('leaves the login form submission alone', () => {
    const action = visit('/login', {
      session: true,
      method: 'POST',
      headers: { 'next-action': 'abc' },
    });

    expect(getRedirectUrl(action)).toBeNull();
    expect(getRedirectUrl(visit('/login', { session: true, method: 'POST' }))).toBeNull();
  });
});

describe('content security policy', () => {
  const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1];

  it('sets the same nonce on the request headers and the policy of the response', () => {
    const response = visit('/bookings', { session: true });

    const policy = response.headers.get('content-security-policy');
    const nonce = response.headers.get('x-middleware-request-x-nonce');
    expect(policy).toContain("script-src 'self'");
    expect(nonce).toBeTruthy();
    expect(nonceOf(policy ?? '')).toBe(nonce);
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
  });

  it('also covers the login page', () => {
    expect(visit('/login').headers.get('content-security-policy')).toContain("'nonce-");
  });

  it('uses a new nonce for every request', () => {
    const first = visit('/', { session: true });
    const second = visit('/', { session: true });

    expect(first.headers.get('x-middleware-request-x-nonce')).not.toBe(
      second.headers.get('x-middleware-request-x-nonce'),
    );
  });

  it('does not allow eval outside development', () => {
    expect(visit('/', { session: true }).headers.get('content-security-policy')).not.toContain(
      'unsafe-eval',
    );
  });
});
