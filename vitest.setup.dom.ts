import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

// Testing Library only cleans up on its own when `globals` is enabled; imports are explicit here.
afterEach(() => {
  cleanup();
  // A test that faked the clock (see `src/test/debounce.ts`) must not leave it faked for the next.
  vi.useRealTimers();
});

// Node's `fetch` rejects a relative URL, a browser resolves it against the page. Client code calls
// `/bff/...`, so resolve those the way the browser would. This wraps the fetch that MSW installed
// in `vitest.setup.ts`, whose `beforeAll` runs first.
const PAGE_ORIGIN = 'http://localhost:3000';
let originalFetch: typeof fetch | undefined;

beforeAll(() => {
  const mswFetch = globalThis.fetch;
  originalFetch = mswFetch;
  globalThis.fetch = (input, init) =>
    mswFetch(
      typeof input === 'string' && input.startsWith('/') ? new URL(input, PAGE_ORIGIN) : input,
      init,
    );
});

afterAll(() => {
  if (originalFetch) globalThis.fetch = originalFetch;
});
