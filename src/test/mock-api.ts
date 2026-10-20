import { createApi } from '../../server/core/api.ts';
import { createMswHandlers } from '../../server/msw.ts';
import { server } from './msw-server';

/** A fixed "now" so seeded data and date-dependent rules are stable across runs. */
export const TEST_NOW = Date.parse('2026-10-14T09:00:00.000Z');

/** Serves the real mock API (the same core as `npm run mock`) to the code under test. */
export const installMockApi = () => {
  const api = createApi({ now: TEST_NOW, clock: () => TEST_NOW });
  server.use(...createMswHandlers(api));
  return api;
};
