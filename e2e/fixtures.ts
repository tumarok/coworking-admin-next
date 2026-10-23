import { test as base, expect, type ConsoleMessage } from '@playwright/test';

import { ADMIN } from './support/auth';
import { ApiClient } from './support/api-client';
import { DEFAULT_MOCK_URL } from './support/mock';

export { expect };

/** Options of the suite that the config sets (see `use` in `playwright.config.ts`). */
export interface TestOptions {
  /** Origin of the mock API: where the tests arrange and read data. */
  apiUrl: string;
}

interface Fixtures {
  /**
   * The mock API, signed in as the admin. Before a test tagged `@mutating` the mock is put back to
   * its seeded data, so such a test never sees what an earlier one changed.
   */
  api: ApiClient;
  /** Fails a test that logged an error in the browser, a CSP violation included. */
  consoleGuard: undefined;
}

/**
 * The browser logs every 4xx and 5xx answer as "Failed to load resource" (Chromium only). Only
 * three are expected: the answers of the app's own API calls, those of the sign-in page and the
 * 404 of the page that the not-found tests ask for. The tests that provoke them assert what the
 * screen says. A script or a stylesheet that fails to load is not among them.
 */
const EXPECTED_FAILURES = /^\/(bff\/|login|no-such-page)/;

const isExpectedFailure = (message: ConsoleMessage) =>
  message.text().startsWith('Failed to load resource') &&
  EXPECTED_FAILURES.test(new URL(message.location().url || 'http://localhost').pathname);

export const test = base.extend<TestOptions & Fixtures>({
  apiUrl: [DEFAULT_MOCK_URL, { option: true }],

  api: [
    async ({ request, apiUrl }, provide, testInfo) => {
      const api = new ApiClient(request, apiUrl);
      if (testInfo.tags.includes('@mutating')) await api.reset();
      await api.signIn(ADMIN.email, ADMIN.password);
      await provide(api);
    },
    { auto: true },
  ],

  consoleGuard: [
    async ({ context }, provide) => {
      const problems: string[] = [];
      context.on('console', (message) => {
        if (message.type() === 'error' && !isExpectedFailure(message)) {
          problems.push(message.text());
        }
      });
      context.on('weberror', (error) => {
        problems.push(`Uncaught: ${error.error().message}`);
      });
      // Firefox does not hand every policy violation to the console API; the event is reliable.
      await context.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
        });
      });
      await provide(undefined);
      expect(problems, 'Errors in the browser console').toEqual([]);
    },
    { auto: true },
  ],
});
