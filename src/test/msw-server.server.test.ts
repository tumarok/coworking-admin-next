import 'server-only';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';

// Guards the `server` project setup: the `server-only` marker is stubbed and MSW answers
// `fetch` in Node, failing requests that have no handler.
describe('server test setup', () => {
  it('answers fetch from a registered handler', async () => {
    server.use(http.get('http://backend.test/ping', () => HttpResponse.json({ ok: true })));

    const response = await fetch('http://backend.test/ping');

    expect(await response.json()).toEqual({ ok: true });
  });

  it('rejects a request without a handler', async () => {
    await expect(fetch('http://backend.test/unknown')).rejects.toThrow();
  });
});
