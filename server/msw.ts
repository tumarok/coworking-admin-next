import { HttpResponse, http } from 'msw';

import type { MockApi } from './core/api.ts';

interface MswOptions {
  /** URL pattern the handlers answer under; what follows it is the API path. */
  prefix?: string;
  /** Credential used when a request carries none, e.g. for code that calls through the BFF. */
  authorization?: string;
}

/**
 * The same mock API as request handlers for Mock Service Worker: component tests (and, if ever
 * needed, the browser) get exactly the behaviour the Node server has.
 */
export const createMswHandlers = (
  api: MockApi,
  { prefix = '*/api/v1', authorization }: MswOptions = {},
) => [
  http.all(`${prefix}/*`, async ({ request }) => {
    const url = new URL(request.url);
    const base = prefix.replace(/^\*/, '');
    const path = url.pathname.slice(url.pathname.indexOf(base) + base.length) || '/';
    const body =
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.json().catch(() => undefined);
    const result = api.handle({
      method: request.method,
      path,
      query: Object.fromEntries(url.searchParams),
      body,
      authorization: request.headers.get('authorization') ?? authorization ?? null,
    });
    if (result.status === 204 || result.body === undefined) {
      return new HttpResponse(null, { status: result.status });
    }
    return HttpResponse.json(result.body as Record<string, unknown>, { status: result.status });
  }),
];
