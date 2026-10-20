'use server';

import type { Route } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LOGIN_MESSAGES, type LoginFailure } from '@/features/auth/messages';
import { ROUTES } from '@/config/routes';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { readApiErrorBody } from '@/lib/api/errors';
import { loginRequestSchema, loginResponseSchema } from '@/lib/contract/auth';
import { backendFetch, SHORT_TIMEOUT_MS } from '@/lib/server/backend';
import { clearSessionCookie, setSessionCookie } from '@/lib/server/session-cookie';

const failure = (message: string): LoginFailure => ({ ok: false, message });

/**
 * Signs in and goes to `from` (or the dashboard). A Server Action is a public endpoint, so the
 * arguments are checked again here whatever the form did. Failures come back as a value for the
 * form to show; success redirects, after the cookie is set and outside any `try`, because
 * `redirect` works by throwing.
 */
export async function login(credentials: unknown, from?: unknown): Promise<LoginFailure> {
  const parsed = loginRequestSchema.safeParse(credentials);
  if (!parsed.success) return failure(LOGIN_MESSAGES.invalid);

  let response: Response;
  try {
    response = await backendFetch('auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(SHORT_TIMEOUT_MS),
    });
  } catch {
    return failure(LOGIN_MESSAGES.unreachable);
  }

  if (!response.ok) {
    // The API's own text ("Invalid email or password") is meant for the user; a gateway page, a
    // crash or a redirect (anything that is not the API's error body) is not.
    const body = response.status < 500 ? await readApiErrorBody(response) : undefined;
    return failure(body?.message ?? LOGIN_MESSAGES.failed);
  }

  const session = loginResponseSchema.safeParse(await response.json().catch(() => undefined));
  if (!session.success) return failure(LOGIN_MESSAGES.failed);

  setSessionCookie(await cookies(), session.data.token);
  // A path the visitor was heading to is a runtime string, so typed routes cannot know it.
  redirect((safeRedirectPath(from) ?? ROUTES.dashboard) as Route);
}

/** Ends the session on this side: the API token is self-contained, so there is nothing to revoke. */
export async function logout(): Promise<never> {
  clearSessionCookie(await cookies());
  redirect(ROUTES.login);
}
