---
name: verify
description: Run the quality gates of this repo in order and read their failures (typegen, ESLint layer boundaries and guardrails, MSW unhandled requests, coverage thresholds). Use before reporting a change as done, after editing code, tests or dependencies, and when a gate fails.
---

# Verify

Run the gates in this order and stop at the first failure: the cheap static checks come first, so
a failure points at the real cause. Run them one at a time; coverage and build output share folders.

```bash
npm run typecheck      # next typegen && tsc --noEmit
npm run lint           # ESLint: typed rules, layer boundaries, guardrails
npm run format:check   # fix with: npm run format
npm test               # Vitest, `unit` and `server` projects, with coverage thresholds
npm run build
```

Narrow runs while iterating: `npm test -- src/lib`, `npm test -- --project server`,
`npm run test:watch`. The last full run must still be the whole list above.

## When e2e is needed

Playwright covers what component tests cannot: routes, layouts and the session guard, forms and
dialogs, API behaviour, list state in the URL, the CSP and accessibility. Run `npm run e2e` when a
change touches any of these, in addition to the gates above. It builds the app, starts the mock
and the standalone server, and runs Chromium and Firefox (about 7 minutes); browsers come from
`npx playwright install chromium firefox`. Narrow runs while iterating:

```bash
npx playwright test --project=chromium-readonly e2e/rooms.spec.ts   # read-only tests
npx playwright test --project=chromium --no-deps e2e/rooms.spec.ts  # `@mutating` tests
npx playwright test -g "refuses an overlapping"                     # by title
```

`--no-deps` skips the other projects; it needs `e2e/.auth/user.json`, which a run of the `setup`
project writes. Run one `npm run e2e` at a time: the mock API and the ports are shared.

## When Docker is needed

Check the images when a change touches `docker/`, `compose.yaml`, `.dockerignore`, `next.config.ts`,
the environment variables or the dependencies of the mock (`server/`, `src/lib/contract`). The
build of an image is the only place where the context and the standalone output are exercised:

```bash
docker compose up --build --wait -d
E2E_BASE_URL=http://localhost:8080 E2E_API_URL=http://localhost:4010 npm run e2e
docker compose down -v
```

A web container that is `unhealthy` while the page answers from outside is a healthcheck that
reaches `localhost` over IPv6. Stop only the containers of this project (`docker compose down`).

## Reading failures

**`next typegen` / `tsc`**: `PageProps`, `LayoutProps` and `Route` are generated types. If they
are missing or stale, `npm run typecheck` regenerates them; a bare `tsc` or an editor does not.

**ESLint `boundaries/dependencies`**: the message names the importing and the imported layer.

- A layer imports upward (`lib` -> `components`, `components` -> `features`), or one feature
  imports another: move the shared piece down into `components` or `lib`, or compose both
  features in `app`.
- A feature data file (`api/**`, `*types.ts`, `*schemas.ts`, `*constants.ts`) imports feature UI:
  move the shared piece into one of those data files.
- Production code imports `src/test` or a test file: move the helper into `lib` or keep it in the
  test.

**ESLint `no-restricted-*` guardrails** (the message says what to use instead): `fetch` outside
`lib/api`, `lib/server`, `app/bff`; `process.env` outside `config/env.ts`; a literal `queryKey`
outside `features/*/api`; `useForm` without `resolver`; `import { z } from 'zod'` (use
`import * as z`); `../../` imports (use `@/`).

**MSW unhandled request** (`onUnhandledFrame: 'error'` in `vitest.setup.ts`): the test sent a
request nobody answers. Register a handler with `server.use(...)` from `@/test/msw-server`.

**`server-only` error in a `unit` test**: a client test imported a server module, as the Next
build would reject. Move the logic out of the server module, or test it in the `server` project
(`*.server.test.ts`, `src/lib/server`, `src/lib/auth`, route handlers).

**e2e `Errors in the browser console`**: the test passed but the page logged an error. A CSP
violation reads `CSP violation: <directive> <blocked uri>`: the page loaded something the policy
in `src/lib/csp.ts` does not allow. Other messages are the app's own `console.error`.

**e2e `Serious or critical accessibility violations`**: axe lists each rule with the elements that
break it (`color-contrast` in the dark scheme, a missing accessible name). Fix the app, not the
test; lesser findings are attached to the test as `a11y` annotations in the HTML report.

**e2e failure in a `@mutating` test after a green read-only run**: the mock is shared, so a test
that left data behind or relied on a count is the usual cause. Read-only tests must not depend on
how many records exist; mutating tests create their own records and the mock is reset before each.

**Coverage thresholds** (`ERROR: Coverage for ... does not meet global threshold`): add tests for
the new code. Do not lower the thresholds or widen the excludes in `vitest.config.mts` to pass.

## Report

State which gates ran and their result. Name any gate you skipped and why. Do not call the work
done with a failing gate.
