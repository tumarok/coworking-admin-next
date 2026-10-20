import 'server-only';
import { env } from '@/config/env';
import { SESSION_COOKIE } from '@/config/session';

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

type CookieOptions = ReturnType<typeof sessionCookieOptions> & { maxAge?: number };

interface CookieWriter {
  set(name: string, value: string, options: CookieOptions): unknown;
}

/**
 * Attributes of the session cookie. Setting and clearing share them: a browser only replaces a
 * cookie that is written with the same name, path and attributes. The cookie has no expiry, so it
 * ends with the browser session and is shared between tabs.
 */
export const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: env.COOKIE_SECURE,
});

/** The API token of the current session; an empty value counts as no session. */
export const readSessionToken = (cookies: CookieReader) =>
  cookies.get(SESSION_COOKIE)?.value || undefined;

export const setSessionCookie = (cookies: CookieWriter, token: string) => {
  cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
};

export const clearSessionCookie = (cookies: CookieWriter) => {
  cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
};
