# Coworking Admin (Next.js)

Admin console for a network of coworking spaces on Next.js 16 (App Router, React 19). Next.js is
the backend-for-frontend: the browser talks to `/bff/*` route handlers, which forward to the REST
API (`API_URL/api/v1`) with the session token taken from an httpOnly cookie.
`README.md` describes the product; this file holds the working rules.

## Before reporting a change as done

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Run them in this order and one at a time (coverage writes to a shared folder). The `verify` skill
explains how to read failures. `npm test` is a single run with coverage thresholds; use
`npm run test:watch` while iterating.

## Layout and layer boundaries

```
src/app/         routes and Next special files only (thin pages), plus bff/ route handlers
src/proxy.ts, src/instrumentation*.ts   Next entry files next to app/
src/features/<name>/   api/ (query keys, queryOptions, mutations), components/, types, schemas
src/components/  shared UI; ui/ holds the shadcn components
src/lib/         api clients, server helpers, pure functions; lib/contract = API contract
src/config/      env, routes, navigation, constants
src/test/        shared test helpers (MSW server, mock API installer)
server/          mock API (outside src): core/, node.ts, msw.ts, index.ts
```

- Imports go downwards: `app` -> `features` -> `components` -> `lib` -> `config`. Features never
  import each other; shared code moves to `components` or `lib`. `components/ui` imports only
  `lib` and itself. Feature data files (`api/**`, `*types.ts`, `*schemas.ts`, `*constants.ts`) do
  not import feature UI. ESLint (`eslint-plugin-boundaries`) enforces this in `eslint.config.mjs`.
- One alias, `@/*` -> `src/*`. Relative imports are `./` or a single `../`.
- No barrel `index.ts`; import by file path. Named exports only, except Next special files
  (`page`, `layout`, `route`, ...) and tool configs. File names are kebab-case; a test sits next to
  its file as `<file>.test.ts(x)`.
- The API contract is Zod schemas and types in `src/lib/contract`, without Next dependencies.
  Change the contract first, then the mock and the code that uses it.
- Contract and `server/` use relative imports with the `.ts` extension, because `npm run mock`
  runs them with Node's type stripping (`erasableSyntaxOnly`: no `enum`, no constructor parameter
  properties). Import types with `import type`, or the mock fails at runtime while `tsc` passes.

## Mock API (`server/`)

- `server/core/` (`api`, `db`, `http`, `rules`) is the whole API and knows nothing about transport:
  it takes an `ApiRequest` and returns an `ApiResponse`. Validation reuses the contract schemas.
- Adapters: `server/node.ts` (`node:http`, CORS, latency) and `server/msw.ts` (MSW handlers for
  tests). `server/index.ts` is the CLI entry.
- `npm run mock` serves `http://localhost:4010/api/v1`. Env: `PORT`, `MOCK_LATENCY_MS` (250),
  `MOCK_SEED` (42), `MOCK_LOG=1`. Demo login `admin@coworking.test` / `demo1234`;
  `POST /api/v1/__reset` (204, no auth) regenerates the data.
- Tests install it with `installMockApi()` from `@/test/mock-api` (fixed `TEST_NOW`).
- Faker data is invented; keep it free of anything real. `server/` and `src/test/mock-api.ts` may
  use `../../` imports (no `@/` alias outside `src`); layer boundaries do not apply to `server/`.

## Code rules (partly enforced by lint)

- `import * as z from 'zod'`, never `import { z }`.
- `fetch` only in `lib/api`, `lib/server`, `app/bff` and tests. `process.env` only in
  `config/env.ts`, `instrumentation*.ts`, `server/index.ts` and tool configs.
- Query keys are written only in `features/*/api`. `useForm` always gets a `resolver`.
- Modules that must stay on the server start with `import 'server-only'`; client components start
  with `'use client'`.
- React Compiler is on (`reactCompiler: true`): no manual `useMemo`/`useCallback`.
- `eslint-disable` needs a reason after `--`.
- shadcn components in `src/components/ui` are generated (`npx shadcn@latest add <name>`), then
  formatted with Prettier. Keep edits there minimal and add only components that are used.

## BFF, session and CSP

- `API_URL` is the origin of the API without a path (`http://localhost:4010`); `lib/server/backend.ts`
  adds `/api/v1`. `config/env.ts` validates the environment when the server starts
  (`instrumentation-node.ts` exits on failure); `SKIP_ENV_VALIDATION` works only inside
  `next build`, so the image needs no `API_URL` at build time and none is baked in.
- The session is the API token in the httpOnly `cw_session` cookie, stored as is (nothing is
  signed). Set and clear go through `lib/server/session-cookie.ts` so their attributes match.
  `COOKIE_SECURE=false` is for plain-HTTP runs only (local, compose, e2e).
- `/bff/[...path]` forwards method, path, query and streamed body with a Bearer token, passes only
  allowlisted headers each way, rejects state-changing calls whose Origin is not this host, marks
  every response `no-store`, clears the cookie on a 401 and logs one JSON line per request.
- `proxy.ts` is only an optimistic redirect to `/login` plus the per-request CSP nonce; it is not
  authorization (Server Actions pass through it too). The root layout calls `await connection()`
  so every page is rendered per request and gets the nonce. Redirect targets go through
  `safeRedirectPath`.

## Auth

- Login and logout are Server Actions in `features/auth/actions.ts` (`'use server'`, async functions
  only; texts live in `messages.ts`). They validate their arguments with the contract schemas, set or
  clear the cookie, and `redirect` last, outside any `try`. Client code that calls them rethrows with
  `unstable_rethrow`, or the redirect is swallowed.
- Authorization is `lib/server/session.ts` (`verifySession`, `getCurrentUser`), called from layouts
  and pages. A token the API rejects goes to `/login?expired=1`; `proxy.ts` leaves that URL alone so
  a stale cookie cannot loop. Other API failures throw for the error page.
- Every Server Action and every page that reads data verifies the session itself: layouts do not
  re-run on soft navigation, so the check in `(app)/layout.tsx` is not enough on its own.
- Signing out (user choice or a 401) goes through `beginSignOut()` in `lib/api/client.ts`: it clears
  the Query cache and mutes the 401 handler until the login page calls `endSignOut()`.

## App shell, data and list state

- Providers (`components/providers.tsx`) import `lib/zod-config` first (`jitless`: Zod's JIT needs
  `unsafe-eval`, which the CSP forbids), then theme (class `.dark`, `next-themes` gets the nonce from
  the `x-nonce` header), Query, nuqs and the toaster.
- The browser calls the API only through `lib/api/client.ts` (`/bff`, responses checked against a
  contract schema, a 401 clears the cache and goes to `/login` once). Lists load on the client with
  TanStack Query; there is no server prefetch, because pages are dynamic anyway and server-formatted
  dates would risk hydration mismatches.
- List state lives in the URL (`lib/list-params.ts`): any change except the page itself returns to
  page 1. `DataTable` is the shared server-paged table; write cells inline in the column definitions
  (React Compiler freezes named cell components that read table state).
- Bookings are typed and printed on the clock of their location, never the browser's: a booking
  carries no zone, so the screens read it from the locations list (`features/bookings/api/booking-zones.ts`)
  and convert with `lib/timezone.ts` (`Intl` numeric parts only, so server and browser agree).
- Query errors toast by default; pass `meta: { silent: true }` when the form shows the error itself.
- Each feature adds its own item to `config/navigation.ts` and its paths to `config/routes.ts`.
- Accessible names: a day button of the calendar is named by the number it shows (`3 June 2027`,
  WCAG 2.5.3), and a button cannot be `aria-required`, so `DatePicker` puts `, required` into its
  own name. axe runs in the e2e suite in both schemes; fix the app, not the test.

## Features

- `features/locations` is the reference feature; new entities copy it by the `add-feature` skill.
  A feature has `api/` (keys, `queryOptions`, mutation hooks), `schemas.ts`, `constants.ts` and
  `components/` (list, details, form dialog, delete dialog); its pages in `app/(app)/<name>/` stay
  thin and verify the session first.
- Query keys start with a root from `config/query-roots.ts`. A feature that changes data other
  screens print invalidates those roots, so features stay independent of each other (a location
  update refreshes rooms, bookings and the dashboard).
- Shared building blocks for lists and forms live in `components/`: `SearchInput`, `FilterSelect`,
  `DataTable`, `FormDialog`, `FormField`, `FormSelect`, `ConfirmDialog` (with `error`), `DetailsList`.
  `lib/form.ts` maps a 422 onto form fields. Component tests reach the mock through
  `installMockApi({ via: 'bff' })`.

## Tests

- Vitest with two projects: `unit` (jsdom, `src/**/*.test.ts(x)`) and `server` (node: route
  handlers, `proxy`, `instrumentation`, `lib/server`, `lib/auth`, `*.server.test.ts(x)`, `server/`).
  Imports from `vitest` are explicit; there are no globals.
- Network goes through MSW (`src/test/msw-server.ts`); an unhandled request fails the test.
  MSW 3 names the option `onUnhandledFrame`; the old `onUnhandledRequest` is silently ignored.
- Query by role and accessible name. Async Server Components are not rendered in Vitest: keep
  pages thin and cover them with e2e.
- Coverage thresholds: 90% lines/statements/functions, 80% branches. `components/ui`, page and
  layout files and `src/test` are excluded.
- The `server` project sets `API_URL` and `COOKIE_SECURE` itself; the upstream API is an MSW handler
  on `http://backend.test`.
- e2e (`npm run e2e`, `e2e/`, `playwright.config.ts`) drives the built app from outside and imports
  nothing of `src/` or `server/` (ESLint enforces it). `webServer` starts the mock (`:4010`) and
  the standalone server (`:3100`, as in the image); `E2E_BASE_URL` and `E2E_API_URL` test an app
  that already runs (compose). Page objects in `e2e/pages` hold the locators, by role and accessible
  name; data is arranged through the mock API (`e2e/support/data.ts`), not by clicking.
- The mock keeps one in-memory database, so the projects are ordered: `setup` signs in once and
  saves the session (the cookie is stateless, so a reset does not end it), then `<browser>-readonly`
  tests run in parallel, then `@mutating` tests run one at a time, Chromium before Firefox, each
  after `POST /__reset`. Tag a test `@mutating` when it creates, changes or deletes data; a
  read-only test never depends on how many records exist.
- Every e2e test fails on a console error or a CSP violation (`consoleGuard` in `e2e/fixtures.ts`);
  `@a11y` tests run axe in the light and the dark scheme (each one first checks that the scheme is
  on screen) and fail on serious or critical findings only; lesser ones go to the annotations of the
  HTML report. `E2E_PORT` moves the app, `E2E_API_URL` points at a mock that is already running.
- `--repeat-each` does not repeat the projects another project depends on, so check flakiness with
  `--project=chromium-readonly --project=firefox-readonly` (read-only tests are the repeated ones).
- A click that makes the page navigate away at once can hang in Chromium (the click is never
  reported as done): trigger such a navigation by an action that ends in a request, not a link.
- A drop-down that searches the server (`AsyncCombobox`) keeps the previous results until the new
  text is answered. In e2e pick from it with `searchAndPick` (`e2e/pages/search-and-pick.ts`), which
  waits for "Searching…" to go; a click on a stale option leaves the list open and flakes only
  under latency.

## CI, images and compose

- `.github/workflows/ci.yml`: `checks` (the gates), `e2e` (Chromium and Firefox, the report of a
  failed run is kept 7 days) and `images` (push to `main` and `v*` tags, never a pull request)
  publish `ghcr.io/<owner>/coworking-admin-next` (`docker/web.Dockerfile`, standalone, non-root) and
  `coworking-admin-next-api` (`docker/api.Dockerfile`, the mock run by Node's type stripping, with
  only `zod` and `@faker-js/faker` copied out of a full install).
- The web image bakes in nothing about the API: `API_URL` is required at start (the container exits
  with code 1 without it) and `COOKIE_SECURE=false` is for plain-HTTP runs only. Its healthcheck uses
  the IPv4 address: the server listens on IPv4 and `localhost` resolves to `::1` first.
- `compose.yaml` runs `api` and `web` (not `app`: `.app` is on the HSTS preload list and Chromium
  then refuses HTTP). The web app is on `:8080`; the mock is also published on the loopback
  interface, because the e2e tests reset it and arrange data through it directly:

  ```bash
  docker compose up --build --wait -d
  E2E_BASE_URL=http://localhost:8080 E2E_API_URL=http://localhost:4010 npm run e2e
  docker compose down -v
  ```

  The mock in compose answers after 150 ms, which finds races a zero-latency run hides.

- `.dockerignore` keeps `server/` and `src/` in the context: `next build` type-checks the whole
  project, and `src/test/mock-api.ts` imports the mock. `e2e/` and `playwright.config.ts` are left
  out together (the config imports the suite) because nothing else imports them.

## Next.js

Before using an unfamiliar Next API, read the matching guide in `node_modules/next/dist/docs/`:
the installed version differs from what you may remember (`proxy.ts` replaces `middleware.ts`,
`params` and `searchParams` are promises, route types come from `next typegen`).

## Tooling in `.claude/`

- Skills: `verify` (the gates and how to read their failures) and `add-feature` (the recipe for an
  entity, modelled on `features/locations`).
- Agents: `reviewer` (read-only review of the pending diff against these rules) and
  `feature-builder` (implements a feature by the skill, runs the gates, does not commit).
- `hooks/format.mjs` runs Prettier on every file the editor tool writes. `settings.local.json`
  (machine settings, such as the Playwright browsers path) and `.playwright-mcp/` are git-ignored.
- `.mcp.json` starts a Playwright server for looking at the running app in a browser.

## Versions and the reasons behind them

- ESLint 9.39: `eslint-config-next` pulls plugins whose peer range stops below ESLint 10.
- TypeScript 6.0.x: typescript-eslint supports TypeScript below 6.1.
- Tailwind 4 through `@tailwindcss/postcss`: works with both Turbopack and webpack.
- `cacheComponents` is off: it would need a Suspense boundary around `await connection()` in the root
  layout, and the nonce CSP needs every page rendered per request.
- Prettier `printWidth` is 100, two spaces, single quotes.
- `public/` holds only `.gitkeep`: the image build and the e2e server copy the folder, so it has to
  exist in a fresh clone.
- `lint` is plain `eslint .` and passes on a clean checkout without `next typegen`; `typecheck`
  runs typegen first.
- The session cookie holds the API token as is (no `jose`): the API owns the token, and the cookie
  only keeps it out of JavaScript.
- `agentRules: false` in `next.config.ts`: Next must not generate its own agent files.
- Vitest runs React Compiler through `@rolldown/plugin-babel` with an explicit `@babel/core` 7:
  without it the optional peer resolves to Babel 8 and `npm install` fails with ERESOLVE.
- `"type": "module"` in `package.json`: without it Node reparses `server/index.ts` and warns on every
  `npm run mock`. Node's native type stripping is used instead of `tsx` (no extra dependency).
- All dependency versions are pinned exactly (`--save-exact`).
