import { NextResponse, type NextRequest } from 'next/server';
import { clearSessionCookie, readSessionToken } from '@/lib/server/session-cookie';
import { backendFetch } from '@/lib/server/backend';
import type { ApiErrorBody } from '@/lib/contract/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Everything else is dropped: cookies and Origin must not reach the API, and its own cookies,
// CORS and caching headers mean nothing to the browser behind this proxy.
const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'retry-after'];

const errorResponse = (status: number, message: string) =>
  NextResponse.json({ message } satisfies ApiErrorBody, {
    status,
    headers: { 'cache-control': 'no-store' },
  });

const pick = (source: Headers, names: string[]) => {
  const picked = new Headers();
  for (const name of names) {
    const value = source.get(name);
    if (value !== null) picked.set(name, value);
  }
  return picked;
};

/** Cookies are `SameSite=Lax`, so a state-changing request must also come from this very host. */
const isSameOrigin = (request: NextRequest) => {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

const isTimeout = (error: unknown) =>
  error instanceof DOMException && error.name === 'TimeoutError';

interface Outcome {
  response: NextResponse;
  /** Kind of failure behind a 5xx the BFF produced itself; never a message (it may hold URLs). */
  failure?: string;
}

const forward = async (request: NextRequest, segments: string[]): Promise<Outcome> => {
  const method = request.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';

  if (hasBody && !isSameOrigin(request)) {
    return { response: errorResponse(403, 'Cross-origin request rejected') };
  }
  // `fetch` resolves dot segments, which would climb out of the `/api/v1` prefix.
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return { response: errorResponse(400, 'Invalid path') };
  }

  try {
    const upstream = await backendFetch(segments.map(encodeURIComponent).join('/'), {
      method,
      search: request.nextUrl.search,
      token: readSessionToken(request.cookies),
      headers: Object.fromEntries(pick(request.headers, FORWARDED_REQUEST_HEADERS)),
      signal: request.signal,
      ...(hasBody && { body: request.body, duplex: 'half' }),
    });
    // The API does not redirect; following one could leave the `/api/v1` prefix or replay a body.
    if (upstream.status >= 300 && upstream.status < 400) {
      return { response: errorResponse(502, 'The API is unavailable'), failure: 'Redirect' };
    }
    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: pick(upstream.headers, FORWARDED_RESPONSE_HEADERS),
    });
    response.headers.set('cache-control', 'no-store');
    if (upstream.status === 401) clearSessionCookie(response.cookies);
    return { response };
  } catch (error) {
    // The browser went away: nobody reads this response, the status is only for the log.
    if (request.signal.aborted) return { response: errorResponse(499, 'Request cancelled') };
    const failure = error instanceof Error ? error.name : 'Unknown';
    if (isTimeout(error)) {
      return { response: errorResponse(504, 'The API took too long to respond'), failure };
    }
    return { response: errorResponse(502, 'The API is unavailable'), failure };
  }
};

const handle = async (request: NextRequest, { params }: RouteContext<'/bff/[...path]'>) => {
  const started = performance.now();
  const segments = (await params).path;
  const { response, failure } = await forward(request, segments);
  // The access log: one line per request on stdout, without the query string (search terms).
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.nextUrl.pathname,
      status: response.status,
      ms: Math.round(performance.now() - started),
      ...(failure && { error: failure }),
    }),
  );
  return response;
};

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
