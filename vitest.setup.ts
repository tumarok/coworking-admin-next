import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/test/msw-server';

// Shared by both projects. A request without a handler fails the test instead of hitting the
// network; `onUnhandledFrame` is the MSW 3 name, the old `onUnhandledRequest` is silently ignored.
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
