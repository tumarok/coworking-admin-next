import { defineConfig, devices } from '@playwright/test';

import type { TestOptions } from './e2e/fixtures';
import { AUTH_FILE } from './e2e/support/auth';
import { DEFAULT_MOCK_URL } from './e2e/support/mock';

const CI = !!process.env.CI;
const APP_PORT = process.env.E2E_PORT ?? '3100';
const viewport = { width: 1400, height: 900 };

/**
 * An address to test instead of starting the app here, such as the containers of `compose.yaml`
 * (`E2E_BASE_URL=http://localhost:8080`). The mock API is then found at `E2E_API_URL`.
 */
const EXTERNAL_URL = process.env.E2E_BASE_URL;
const MOCK_URL = process.env.E2E_API_URL ?? DEFAULT_MOCK_URL;

/**
 * The mock API keeps one in-memory database for everybody, so the suite has two kinds of tests.
 * Those that only read run in parallel. Those tagged `@mutating` change data: they run one at a
 * time, after every read-only project has finished, and reset the mock before each test. The two
 * browsers take turns for the same reason, and every project starts from the one session that the
 * `setup` project signed in (the session cookie is stateless, so a reset does not end it).
 */
export default defineConfig<TestOptions>({
  testDir: 'e2e',
  testMatch: /.*\.spec\.ts/,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  expect: { timeout: 10_000 },
  use: {
    baseURL: EXTERNAL_URL ?? `http://localhost:${APP_PORT}`,
    apiUrl: MOCK_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
    // Not the zone of the locations the tests create: what is printed must follow the location.
    timezoneId: 'America/Los_Angeles',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], viewport },
    },
    {
      name: 'chromium-readonly',
      grepInvert: /@mutating/,
      fullyParallel: true,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport, storageState: AUTH_FILE },
    },
    {
      name: 'firefox-readonly',
      grepInvert: /@mutating/,
      fullyParallel: true,
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'], viewport, storageState: AUTH_FILE },
    },
    {
      name: 'chromium',
      grep: /@mutating/,
      workers: 1,
      dependencies: ['chromium-readonly', 'firefox-readonly'],
      use: { ...devices['Desktop Chrome'], viewport, storageState: AUTH_FILE },
    },
    {
      name: 'firefox',
      grep: /@mutating/,
      workers: 1,
      dependencies: ['chromium'],
      use: { ...devices['Desktop Firefox'], viewport, storageState: AUTH_FILE },
    },
  ],
  webServer: EXTERNAL_URL
    ? undefined
    : [
        {
          command: 'npm run mock',
          // The mock answers 401 to a request without a token, which is as good as up.
          url: `${MOCK_URL}/api/v1/auth/me`,
          env: { PORT: new URL(MOCK_URL).port, MOCK_LATENCY_MS: '0', MOCK_LOG: '0' },
          reuseExistingServer: !CI,
          timeout: 30_000,
        },
        {
          // The image runs the standalone server, so the suite does too. Locally a server already
          // on the port is reused and may serve an older build.
          command:
            'npm run build && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/ && node .next/standalone/server.js',
          url: `http://localhost:${APP_PORT}/login`,
          env: {
            PORT: APP_PORT,
            HOSTNAME: 'localhost',
            API_URL: MOCK_URL,
            COOKIE_SECURE: 'false',
            NEXT_TELEMETRY_DISABLED: '1',
          },
          reuseExistingServer: !CI,
          timeout: 240_000,
        },
      ],
});
