import { describe, expect, it } from 'vitest';
import { loginResponseSchema } from '@/lib/contract/auth';
import { dashboardSchema } from '@/lib/contract/dashboard';
import { pageOf } from '@/lib/contract/common';
import { locationSchema } from '@/lib/contract/location';
import { roomSchema } from '@/lib/contract/room';
import { installMockApi } from '@/test/mock-api';
import { DEMO_PASSWORD } from './core/db.ts';

const BASE = 'http://localhost/api/v1';

const signIn = async () => {
  const response = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@coworking.test', password: DEMO_PASSWORD }),
  });
  expect(response.status).toBe(200);
  return { Authorization: `Bearer ${loginResponseSchema.parse(await response.json()).token}` };
};

describe('MSW adapter', () => {
  it('serves the mock API through fetch', async () => {
    installMockApi();
    const headers = await signIn();

    const rooms = await fetch(`${BASE}/rooms?limit=5`, { headers });

    expect(rooms.status).toBe(200);
    expect(pageOf(roomSchema).parse(await rooms.json()).items).toHaveLength(5);
  });

  it('runs the mock on the fixed test clock', async () => {
    installMockApi();
    const headers = await signIn();

    const dashboard = await fetch(`${BASE}/dashboard`, { headers });

    expect(dashboardSchema.parse(await dashboard.json()).date).toBe('2026-10-14');
  });

  it('answers 204 without a body and passes JSON bodies through', async () => {
    installMockApi();
    const headers = await signIn();

    const reset = await fetch(`${BASE}/__reset`, { method: 'POST' });
    const invalid = await fetch(`${BASE}/locations`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(reset.status).toBe(204);
    expect(await reset.text()).toBe('');
    expect(invalid.status).toBe(422);
  });

  it('can answer under the BFF prefix and sign in for the caller', async () => {
    installMockApi({ via: 'bff' });

    const response = await fetch('http://localhost/bff/locations?limit=2');

    expect(response.status).toBe(200);
    expect(pageOf(locationSchema).parse(await response.json()).items).toHaveLength(2);
  });
});
