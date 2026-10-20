import type { AddressInfo } from 'node:net';
import { http, passthrough } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server as msw } from '@/test/msw-server';
import { createApi } from './core/api.ts';
import { createNodeServer } from './node.ts';

const NOW = Date.parse('2026-10-14T09:00:00.000Z');

const servers: ReturnType<typeof createNodeServer>[] = [];

const start = async () => {
  const server = createNodeServer(createApi({ now: NOW, clock: () => NOW }));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  // Real sockets: the suite-wide MSW server must let these requests through.
  msw.use(http.all(`${base}/*`, () => passthrough()));
  return base;
};

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

describe('Node adapter', () => {
  it('answers a preflight request with CORS headers and no body', async () => {
    const base = await start();

    const response = await fetch(`${base}/api/v1/locations`, { method: 'OPTIONS' });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain('PATCH');
    expect(await response.text()).toBe('');
  });

  it('answers 404 outside the API prefix', async () => {
    const base = await start();

    const response = await fetch(`${base}/health`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'Not found' });
  });

  it('requires a token and treats an invalid JSON body as an empty one', async () => {
    const base = await start();

    const guarded = await fetch(`${base}/api/v1/locations`);
    const login = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });

    expect(guarded.status).toBe(401);
    expect(login.status).toBe(422);
    expect(login.headers.get('content-type')).toBe('application/json');
  });

  it('answers 204 without a body on reset', async () => {
    const base = await start();

    const response = await fetch(`${base}/api/v1/__reset`, { method: 'POST' });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });
});
