import { describe, expect, it } from 'vitest';
import { QUERY_ROOTS } from '@/config/query-roots';
import { dashboardKeys } from './dashboard-keys';

describe('dashboardKeys', () => {
  it('starts every key with the root, so one call drops them all', () => {
    expect(dashboardKeys.all).toEqual([QUERY_ROOTS.dashboard]);
    expect(dashboardKeys.overview('2026-10-14')[0]).toBe(QUERY_ROOTS.dashboard);
    expect(dashboardKeys.locations()[0]).toBe(QUERY_ROOTS.dashboard);
  });

  it('keeps each day under its own key, and "the API\'s today" apart from every day', () => {
    expect(dashboardKeys.overview('2026-10-14')).not.toEqual(dashboardKeys.overview('2026-10-15'));
    expect(dashboardKeys.overview('')).not.toEqual(dashboardKeys.overview('2026-10-14'));
  });
});
