import { createApi, TOKEN_PREFIX } from '../../server/core/api.ts';
import { createMswHandlers } from '../../server/msw.ts';
import { server } from './msw-server';

export { toBookingView } from '../../server/core/api.ts';

/** A fixed "now" so seeded data and date-dependent rules are stable across runs. */
export const TEST_NOW = Date.parse('2026-10-14T09:00:00.000Z');

/**
 * Serves the real mock API (the same core as `npm run mock`) to the code under test. With
 * `via: 'bff'` it answers browser code on `/bff/*` and signs in as the demo admin, the way the
 * BFF does with the session cookie.
 */
export const installMockApi = ({ via = 'api' }: { via?: 'api' | 'bff' } = {}) => {
  const api = createApi({ now: TEST_NOW, clock: () => TEST_NOW });
  server.use(
    ...createMswHandlers(
      api,
      via === 'bff' ? { prefix: '*/bff', authorization: `Bearer ${TOKEN_PREFIX}usr_admin` } : {},
    ),
  );
  return api;
};
