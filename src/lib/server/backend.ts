import 'server-only';
import { env } from '@/config/env';

const API_PREFIX = '/api/v1';
/** Generous on purpose: exports and slow lists must not be cut off by the BFF. */
const BACKEND_TIMEOUT_MS = 5 * 60_000;

/**
 * URL of an API path. The parts are joined as strings: `new URL(path, base)` would drop the
 * `/api/v1` prefix of the base.
 */
export const backendUrl = (path: string, search = '') =>
  `${env.API_URL}${API_PREFIX}/${path.replace(/^\/+/, '')}${search}`;

interface BackendInit extends Omit<RequestInit, 'cache' | 'headers'> {
  headers?: Record<string, string>;
  /** Query string including the leading `?`. */
  search?: string;
  /** Session token, sent as a Bearer credential. */
  token?: string | undefined;
}

/** Calls the REST API from the server: never cached, redirects are returned, not followed, with a timeout that also follows `signal`. */
export const backendFetch = (
  path: string,
  { search, token, headers, signal, ...init }: BackendInit = {},
) => {
  const timeout = AbortSignal.timeout(BACKEND_TIMEOUT_MS);
  return fetch(backendUrl(path, search), {
    ...init,
    headers: token ? { ...headers, authorization: `Bearer ${token}` } : headers,
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    cache: 'no-store',
    redirect: 'manual',
  });
};
