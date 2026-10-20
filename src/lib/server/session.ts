import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { userSchema } from '@/lib/contract/auth';
import { backendFetch, SHORT_TIMEOUT_MS } from '@/lib/server/backend';
import { readSessionToken } from '@/lib/server/session-cookie';

/** Where a visitor with a rejected token goes: `expired` keeps `proxy.ts` from bouncing them back. */
export const EXPIRED_LOGIN_URL = `${ROUTES.login}?expired=1` as const;

export const getSessionToken = async () => readSessionToken(await cookies());

/**
 * The session token, or a redirect to the login page. This is the real check; `proxy.ts` only
 * looks for a cookie. Cached per request, so layouts and pages share one answer.
 */
export const verifySession = cache(async () => {
  const token = await getSessionToken();
  if (!token) redirect(ROUTES.login);
  return token;
});

/**
 * The signed-in user, asked from the API. A token the API rejects is a stale session: a Server
 * Component cannot clear the cookie, so the visitor goes to the login page with `expired` set.
 * Any other failure is an error for the error page, not a reason to sign out.
 */
export const getCurrentUser = cache(async () => {
  const token = await verifySession();
  let response: Response;
  try {
    response = await backendFetch('auth/me', {
      token,
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(SHORT_TIMEOUT_MS),
    });
  } catch {
    throw new Error('The API is unavailable');
  }
  if (response.status === 401) redirect(EXPIRED_LOGIN_URL);
  if (!response.ok) throw new Error('Could not load the signed-in user');

  const user = userSchema.safeParse(await response.json().catch(() => undefined));
  if (!user.success) throw new Error('The API sent an unexpected user');
  return user.data;
});
