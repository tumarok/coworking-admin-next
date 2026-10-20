import { NextResponse } from 'next/server';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '@/config/session';
import { server } from '@/test/msw-server';

const { RedirectSignal, store } = vi.hoisted(() => ({
  RedirectSignal: class extends Error {
    readonly url: string;
    constructor(url: string) {
      super(`redirect to ${url}`);
      this.url = url;
    }
  },
  store: { current: undefined as unknown as { get(name: string): unknown } },
}));

vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(store.current) }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

import { getCurrentUser, getSessionToken, verifySession } from './session';

const ME_URL = 'http://backend.test/api/v1/auth/me';
const user = { id: 'usr_1', name: 'Alex', email: 'alex@coworking.test', role: 'admin' };

const signIn = (token: string) => {
  const cookies = new NextResponse().cookies;
  cookies.set(SESSION_COOKIE, token);
  store.current = cookies;
};

const redirectOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  return undefined;
};

beforeEach(() => {
  store.current = new NextResponse().cookies;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getSessionToken', () => {
  it('reads the token from the session cookie', async () => {
    signIn('tok-1');

    expect(await getSessionToken()).toBe('tok-1');
  });

  it('is undefined without a cookie or with an empty one', async () => {
    expect(await getSessionToken()).toBeUndefined();

    signIn('');

    expect(await getSessionToken()).toBeUndefined();
  });
});

describe('verifySession', () => {
  it('returns the token of a signed-in visitor', async () => {
    signIn('tok-1');

    expect(await verifySession()).toBe('tok-1');
  });

  it('sends a visitor without a session to the login page', async () => {
    expect(await redirectOf(verifySession())).toBe('/login');
  });
});

describe('getCurrentUser', () => {
  it('asks the API who the token belongs to', async () => {
    signIn('tok-1');
    const seen: (string | null)[] = [];
    server.use(
      http.get(ME_URL, ({ request }) => {
        seen.push(request.headers.get('authorization'));
        return HttpResponse.json(user);
      }),
    );

    expect(await getCurrentUser()).toEqual(user);
    expect(seen).toEqual(['Bearer tok-1']);
  });

  it('sends a visitor without a session to the login page', async () => {
    expect(await redirectOf(getCurrentUser())).toBe('/login');
  });

  it('treats a token the API rejects as an expired session', async () => {
    signIn('stale');
    server.use(http.get(ME_URL, () => HttpResponse.json({ message: 'Expired' }, { status: 401 })));

    expect(await redirectOf(getCurrentUser())).toBe('/login?expired=1');
  });

  it('does not wait minutes for an API that hangs', async () => {
    signIn('tok-1');
    server.use(http.get(ME_URL, () => HttpResponse.json(user)));
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(AbortSignal.abort(new DOMException('timed out', 'TimeoutError')));

    await expect(getCurrentUser()).rejects.toThrow('The API is unavailable');
    expect(timeout).toHaveBeenCalledWith(10_000);
  });

  it.each([
    ['is unreachable', () => HttpResponse.error(), 'The API is unavailable'],
    [
      'answers 500',
      () => HttpResponse.json({ message: 'boom' }, { status: 500 }),
      'Could not load the signed-in user',
    ],
    [
      'sends an unexpected user',
      () => HttpResponse.json({ id: 1 }),
      'The API sent an unexpected user',
    ],
    ['sends no JSON', () => new HttpResponse('x'), 'The API sent an unexpected user'],
  ])('throws for the error page when the API %s', async (_name, respond, message) => {
    signIn('tok-1');
    server.use(http.get(ME_URL, respond));

    await expect(getCurrentUser()).rejects.toThrow(message);
  });
});
