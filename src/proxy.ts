import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/config/env';
import { SESSION_COOKIE } from '@/config/session';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { buildCsp, createNonce } from '@/lib/csp';

const LOGIN_PATH = '/login';

/** The page the visitor asked for, to return to after login. Next's `_rsc` token is not part of it. */
const requestedPath = (request: NextRequest) => {
  const search = new URLSearchParams(request.nextUrl.searchParams);
  search.delete('_rsc');
  const query = search.toString();
  return request.nextUrl.pathname + (query ? `?${query}` : '');
};

/**
 * Optimistic gate: it only checks that a session cookie exists, so a visitor without one never
 * sees a protected page flash. The API still rejects a bad token with 401, and pages and Server
 * Actions verify the session themselves. It also gives every page response its own CSP nonce.
 */
export function proxy(request: NextRequest) {
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value;
  const isLogin = request.nextUrl.pathname === LOGIN_PATH;

  if (!hasSession && !isLogin) {
    const url = new URL(LOGIN_PATH, request.url);
    const from = requestedPath(request);
    if (from !== '/') url.searchParams.set('from', from);
    return NextResponse.redirect(url);
  }

  // A login Server Action is a POST to this page: redirecting it would break the form.
  const isPageVisit = request.method === 'GET' || request.method === 'HEAD';
  if (hasSession && isLogin && isPageVisit && !request.headers.has('next-action')) {
    const target = safeRedirectPath(request.nextUrl.searchParams.get('from')) ?? '/';
    return NextResponse.redirect(new URL(target, request.url));
  }

  const nonce = createNonce();
  const csp = buildCsp(nonce, env.NODE_ENV === 'development');
  // Next reads the nonce from the CSP header of the request and puts it on its own scripts.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', csp);
  return response;
}

// A literal: Next reads it at build time. Static files, the BFF and assets need neither the
// login redirect nor a CSP, and a redirect would break the JSON client.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|bff(?:/|$)|.*\\.(?:png|ico|svg|json|txt)$).*)',
  ],
};
