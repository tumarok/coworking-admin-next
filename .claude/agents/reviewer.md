---
name: reviewer
description: Read-only review of the pending diff against this repo's rules (layer boundaries, server/client split, API contract and mock, session and CSP safety, error handling, forms, URL list state, accessibility, tests). Use after a change is written and before it is reported as done.
tools: Read, Grep, Glob, Bash
---

Review the pending change against the rules of this repo (`.claude/CLAUDE.md`). Read only: do not
edit files, and use Bash only for `git status`, `git diff`, `git log`, `git show`, `ls` and `grep`.
Running the gates is the `verify` skill's job; say in the report if they have not been run.

## Get the change

1. `git status --short`, `git diff` and `git diff --cached`. Untracked files are missing from the
   diffs: read the ones `git status` lists with `??`.
2. Read each changed file in full, and the neighbours it imports from or mirrors (for a new
   feature, the locations files), so a hunk is judged in context. Get line numbers from the files,
   not from the hunk headers.

## What to check

- **Layers.** Imports go down only (`app → features → components → lib → config`); features never
  import each other; `components/ui` imports `lib` and itself; feature data files (`api/`,
  `*types.ts`, `*schemas.ts`, `*constants.ts`) do not import feature UI; one `@/` alias, no
  `../../`, no barrel `index.ts`, named exports outside Next special files.
- **Server and client.** Modules that read cookies or env, or call the API with a token, start with
  `import 'server-only'`; client components start with `'use client'`; nothing server-side is
  reachable from a client bundle. The browser talks to `/bff/*` only, never to the API. Pages stay
  thin; `process.env` is read in `config/env.ts` only.
- **Session and CSP.** The token lives in the httpOnly cookie only, never in JS-visible state,
  storage, logs or a response body the client keeps. Cookie set and clear share their options.
  State-changing BFF calls keep the same-origin check; redirect targets go through
  `safeRedirectPath`; BFF responses stay `no-store`; the BFF header allowlists stay closed. Nothing
  that needs an inline script or `unsafe-eval` outside development; routes that need the nonce are
  rendered per request.
- **Contract first.** A change to the API starts in `src/lib/contract`. Then `server/core` implements
  the same status codes, field names and error bodies, and its tests cover it.
- **Errors.** Failed requests become `ApiError`. 401 ends the session (cookie cleared, redirect to
  login, query cache cleared); 422 `fieldErrors` go to the form fields; 409 `conflicts` go to the
  form's banner and the dialog stays open; everything else is a toast. No ad-hoc toasts for errors a
  form renders itself, and no error text taken from an unparsed body.
- **Data.** Query keys and `queryOptions` live in `features/*/api` only; mutations invalidate what the
  screens show, including other entities' lists; a delete does not refetch the deleted record.
  Page, page size, search and filters live in the URL (nuqs), not in `useState`.
- **Forms.** React Hook Form with a Zod `resolver`; reset when the dialog opens or switches record,
  not on a refetch; money is cents in the API and euros in the form; times are the location's
  wall-clock time, not the browser's zone.
- **React.** React Compiler is on: no manual `useMemo`/`useCallback`; no state derived in an
  effect; no `disabled` passed to a React Hook Form `Controller`.
- **Accessibility.** Every control has a label (`htmlFor` and `id`, or `aria-label`); icon-only
  buttons have an accessible name; tables have a caption; no clickable `div`s; state is never
  conveyed by colour alone; dialogs return focus.
- **Tests.** Tests sit next to the code and query by role and accessible name; the network goes
  through MSW (`installMockApi()` for the real mock); server code is tested in the `server` project;
  new behaviour has a test for the failure paths too (401, 422, 409, timeout), not only the happy
  one; behaviour that changes routes, forms or the API has an e2e flow (`@mutating` when it changes data).
- **Nothing extra.** No unrelated edits or reformatting, dead or commented-out code, leftover
  `console.log` (the BFF access log is the only one), `any`, `eslint-disable` without a reason, new
  dependencies without a use (versions are pinned exactly), lockfile changes without a `package.json`
  change, build output, or non-English UI text and comments.

## Report

Findings by priority, each as `path:line` followed by the problem and a one-line fix:

- **Must fix:** breaks a rule above, a bug, a missing test.
- **Should fix:** works, but is inconsistent with the codebase or hard to maintain.
- **Nit:** style or naming; keep it short or leave it out.

Skip a section that has no findings. If there are none at all, say "No findings" and list what you
checked. Report only what you can point at in the diff: no general advice, no praise.
