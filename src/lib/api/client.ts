import * as z from 'zod';
import { ApiError, parseApiError } from '@/lib/api/errors';
import { getQueryClient } from '@/lib/query-client';
import { ROUTES } from '@/config/routes';

/** The browser only talks to the BFF; it adds the session token and forwards to the API. */
const BASE = '/bff';

type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

/** Query string with a leading `?`, or an empty string. Empty values are left out. */
export const toSearch = (query: Record<string, QueryValue> = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : '';
};

let signingOut = false;

// Back from the login page may restore this page from the back/forward cache with the flag still
// set; the next 401 must be handled again.
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) signingOut = false;
  });
}

/**
 * An expired or rejected session: drop everything cached for the old user and go to the login
 * page, once. Parallel requests failing together must not start several navigations.
 */
const handleUnauthorized = () => {
  if (signingOut || window.location.pathname === ROUTES.login) return;
  signingOut = true;
  getQueryClient().clear();
  const from = window.location.pathname + window.location.search;
  window.location.assign(
    from === ROUTES.dashboard ? ROUTES.login : `${ROUTES.login}?from=${encodeURIComponent(from)}`,
  );
};

const send = async (method: string, path: string, { query, body, signal }: RequestOptions) => {
  let response: Response;
  try {
    response = await fetch(`${BASE}/${path.replace(/^\/+/, '')}${toSearch(query)}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      body: body === undefined ? null : JSON.stringify(body),
      signal: signal ?? null,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, { message: 'Cannot reach the server. Check your connection.' });
  }
  if (!response.ok) {
    const error = await parseApiError(response);
    if (error.status === 401) handleUnauthorized();
    throw error;
  }
  return response;
};

const readJson = async <S extends z.ZodType>(response: Response, schema: S) => {
  const parsed = schema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) {
    throw new ApiError(502, { message: 'The server sent an unexpected response' });
  }
  return parsed.data;
};

/** Typed calls to the API through the BFF. Responses are checked against the contract schema. */
export const api = {
  get: async <S extends z.ZodType>(path: string, schema: S, options: RequestOptions = {}) =>
    readJson(await send('GET', path, options), schema),

  post: async <S extends z.ZodType>(path: string, schema: S, options: RequestOptions = {}) =>
    readJson(await send('POST', path, options), schema),

  patch: async <S extends z.ZodType>(path: string, schema: S, options: RequestOptions = {}) =>
    readJson(await send('PATCH', path, options), schema),

  /** For calls that answer 204 No Content. */
  delete: async (path: string, options: RequestOptions = {}) => {
    await send('DELETE', path, options);
  },
};
