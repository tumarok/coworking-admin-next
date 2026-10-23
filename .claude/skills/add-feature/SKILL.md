---
name: add-feature
description: Recipe for adding an entity or CRUD feature (contract, mock, query keys and mutations, form dialog, list and details pages, navigation, cross-feature invalidation, tests, e2e), modelled on locations. Use when asked to add an entity, a screen, an endpoint or a form to the app.
---

# Add an entity or feature

`features/locations` is the reference implementation; keep its files open next to the ones you
create. Below, `<name>` is the singular (`location`), `<names>` the plural (`locations`). Work in
this order: the contract and the mock must agree before the UI depends on them. Layer rules are in
`.claude/CLAUDE.md`; features never import each other.

## 1. Contract (Zod, first)

`src/lib/contract/<name>.ts`, modelled on `location.ts`; relative imports with `.ts` (the mock runs
it with Node's type stripping), `import type` for types.

- Value lists as `as const` arrays plus `z.enum`.
- `<name>Schema` for the response (derived fields included), `<name>PageSchema = pageOf(<name>Schema)`.
- `<name>InputSchema` for the request body, messages as `{ error: '...' }`. A cross-field rule is a
  `.refine(..., { error, path })` on the field the user must fix.
- `<name>ListQuerySchema = pageQuerySchema.extend({ ...filters })`; types `<Name>`, `<Name>Input`.
- Money is integer cents, wall-clock times are `timeOfDaySchema` ("HH:mm"), instants are
  `isoDateTimeSchema` in UTC, calendar dates are `isoDateSchema` (print them with `formatDate` from
  `lib/format-date.ts`, which works on the digits of the string: no `Date`, no `Intl`, so no time
  zone or ICU version can change the text between server and browser).
- An optional text the API stores as `null` is normalised by the input schema (`.nullable()` then
  `.transform((v) => v || null)`), and the mock stores what the schema returned: no second rule in
  `server/core/api.ts`.
- A value the API stores normalised is normalised by the input schema too, so the form sends what
  will be stored: `z.string().trim().toLowerCase().pipe(z.email({ error }))` for an email.

## 2. Mock

`server/core/db.ts` (record type, collection on `Db`, seed rows, ids from `nextId`) and
`server/core/api.ts` (routes in the style of the `// --- locations` block: `parse` with the
contract schemas, `paginate`, `findOr404`, `conflict` for a delete with dependants, `invalid` for a
cross-entity 422; specific paths before `/:id`). Add tests in `server/core/api.test.ts` or
`rules.test.ts`. Component tests reach the mock through `installMockApi({ via: 'bff' })`.

## 3. Feature data layer: `src/features/<names>/`

- `api/<name>-keys.ts`: `<name>Keys` with `all`, `lists()`, `list(query)`, `details()`, `detail(id)`.
  Every key starts with the root from `config/query-roots.ts` (add the root there for a new entity).
- `api/<name>-queries.ts`: `queryOptions` for the list (`placeholderData: keepPreviousData`) and the
  detail (`meta: { silent: true }`: the details page explains the failure itself; the options take
  `{ enabled }` so a page that just deleted the record can stop asking for it).
- `api/<name>-mutations.ts`: `useCreate…`, `useUpdate…(id)`, `useDelete…`. All invalidate the
  feature's whole root (`<name>Keys.all`), so any list-like key stays fresh; update stores the
  answer with `setQueryData`, puts it into the cached lists with `replaceInLists` (`lib/query-cache.ts`,
  so a dialog opened from a row before the refetch lands shows the saved values) and also invalidates the roots of other features that print this
  entity's fields; delete removes the detail first (never refetch the deleted id). All carry `meta: { silent: true }` because the form or the
  confirm dialog shows the error. Do not `await` invalidations.
- A form that picks a record of another entity (a room's location) has its own lookup in `api/`:
  `queryOptions` for a search (`q`, first page, `keepPreviousData`) and for one record by id, both
  `silent` and keyed under this feature's root (`roomKeys.locationOptions(term)`). The feature
  never imports the other feature's keys or queries; only the contract.
  The by-id lookup key is `lookupKey(own root, entity root, id)` (`config/query-roots.ts`): the
  entity's own delete mutation then drops it with `removeQueries({ predicate: isLookupOf(...) })`,
  and its create mutation invalidates this feature's root so the new record can be found.
- Other features that change what this one shows invalidate its root (`[QUERY_ROOTS.<names>]`)
  from their own mutations: that is how features stay independent.
- `schemas.ts`: the form schema (usually the contract input schema), defaults, field names for a
  422, `toFormValues(<name>?)`. When the form differs from the API input (euros vs cents, local
  time vs UTC, euros vs cents with `lib/money.ts`), convert here (`toFormValues`, `toRoomInput`) and
  test both directions. An optional text field the API takes as `null` (`company`) is a string in
  the form schema (`inputSchema.extend({ company: z.string()... })`) and `toXInput` maps `''` to
  `null`; `toFormValues` maps `null` to `''`. A number field uses `register(name, { valueAsNumber: true })`; the schema
  gives the blank field (`NaN`) its own message. `constants.ts`: option lists, filter keys.

## 4. Components: `src/features/<names>/components/`

- `<name>-form-dialog.tsx`: `FormDialog` (shared, from `components/`) around a form component that
  owns `useForm` (`zodResolver`, `mode: 'onTouched'`, `defaultValues: toFormValues(...)`). The dialog
  owns the mutation so Escape is ignored while saving. Fields use `FormField` / `FormSelect`; no
  `disabled` on a `Controller`, a `fieldset disabled` instead. On failure `applyServerErrors`
  (`lib/form.ts`) puts 422 messages under their fields and returns the text for the form alert;
  focus the first invalid field once the form is enabled again. Success: toast, close, `onSaved`.
- Picking a record of a long list: `AsyncCombobox` (`components/`, server search with a debounced
  `q`, label by id for a value that is not on the page); several values of a short list:
  `MultiSelect` (values come back in the order of the options). `AsyncCombobox` needs `unknownLabel`
  (shown for an id it cannot resolve) and a distinct `triggerLabel` per control. Both take the `control` props of `FormField` and a `ref` for the focus after a
  failed save; wrap them in `Controller`. Base UI empties the selection when the typed text is
  deleted completely, so a test that replaces the text selects it first (`user.tripleClick`).
- `delete-<name>-dialog.tsx`: `ConfirmDialog` with `error`: a 409 stays in the dialog.
- `<names>-list.tsx`: `useListParams(FILTER_KEYS, FILTER_VALUES)` (values outside the lists count as
  no filter), `useQuery(<names>Query(params.query))`,
  `SearchInput`, one `FilterSelect` per filter, "Clear filters" when something is set, `DataTable`
  (cells written inline in the column definitions; `rowLabel`, `error`, `onRetry`, `empty` text),
  row actions as icon buttons named `Edit <name>` / `Delete <name>`.
- `<name>-details.tsx`: loading placeholder (error state only when there is no data: a failed
  background refetch keeps the page), 404 → `EmptyState` with a link back (no toast), other
  errors → message and retry, `DetailsList`, edit and delete. After a delete show the placeholder
  until `router.replace` lands.
- Status badges for a new status type go to `components/status-badge.tsx`. A plain enum such as a
  plan is text (`humanize`), not a badge.
- A table cell that can hold long text (a company name) wraps in a `max-w-*` block with
  `whitespace-normal`; the cells are `nowrap` by default and would push status and actions off screen.
- A unique field the API refuses with a 422 (`fieldErrors.email`) needs no special code: it is
  listed in the form's field names, so `applyServerErrors` shows it under the field and focuses it.
  Test it against the real mock (create with an address that exists, in another case).
- Dialogs keep their record in state after closing (a separate `open` flag), so the title does not
  change during the fade-out.
- Deliberate choices, keep them: the form dialog has no description (errors are announced through
  `role="alert"`, and a failed save with no field to blame moves focus to that banner); a malformed
  id gives the `notFound()` page, and a well-formed id the API does not know gives an inline
  `EmptyState`. Both answer HTTP 200: `loading.tsx` streams the page, so the status is sent before
  `notFound()` runs (measured on `/locations/bad%20id` and `/rooms/bad%20id`).

## 5. Pages and navigation

- `src/app/(app)/<names>/page.tsx` and `[id]/page.tsx`: thin; `await verifySession()` first, then the
  component. `[id]`: `await params`, `notFound()` when `!isEntityId(id)`, `metadata.title`. One
  `loading.tsx` per entity folder.
- `config/routes.ts` (`<names>` and `<name>(id)`) and `config/navigation.ts` (item with an icon).
- A details page that embeds another entity's list composes the two features in the page file;
  the features themselves stay apart.

## 6. Component tests, next to the code

`renderWithProviders` from `@/test/render-with-providers` (query client + nuqs with a URL in
memory, returns `user` and `lastUrl()`); `installMockApi({ via: 'bff' })`; mock `sonner` and
`next/navigation` (`useRouter`) per file. Query by role and accessible name, never by CSS.

- A test that opens an `AsyncCombobox` needs `installMockApi({ via: 'bff' })` even for a
  validation case, or its search is an unhandled request.
- The dialog moves the focus to its first field a moment after it opens. A test that types into
  another field first waits for that (`await waitFor(() => expect(first).toHaveFocus())`), or the
  first field takes the rest of the characters. Name rows after the record (`Edit Ada Lovelace`).
- Seeded rows are fixed at `TEST_NOW`: pick a record with and one without upcoming bookings once
  (a throwaway script over `createApi`) and keep their ids in a comment-explained constant.
  Derive names and counts from `installMockApi()` (`src/test/mock-members.ts` shows how), do not
  hard-code faker output.
- A debounced search box: `const { user, pause } = useFakeDebounce()` (`src/test/debounce.ts`) before
  rendering, type, `pause()`, then wait for something cheap (`findByText('1–1 of 1')`,
  `findByRole('link', { name })`, `queries.length`). Never poll `getAllByRole('row')` in a `waitFor`:
  each call walks the whole table and, with the suite running in parallel, outlasts the default
  second. Raising the timeout is not the fix.
- Form: defaults, prefill, validation messages, create and edit happy paths (assert the toast and
  `onSaved`), a 422 under its field with focus (override the handler with `server.use`), another
  failure as an alert, dialog kept open, Escape ignored while saving, reset after reopening.
- Delete: success, the 409 message inside the dialog.
- List: rows from the mock, search (one request, URL updated), filter and "Clear filters", empty,
  failed load and retry, pagination, create → `router.push`, edit from the row.
- Details: fields, 404 without a toast, other error and retry, edit, delete refused, delete done.
- Register the key factory in `src/config/query-roots.test.ts` (typo guard for the roots).
- Key factory (every key starts with the root), schema mapping, mutations (which roots they invalidate).

## 7. End-to-end

A spec in `e2e/` next to the existing ones, with the page objects (`e2e/pages`) and the data helpers
(`e2e/support/data.ts`) already there; arrange data through the API, not by clicking. One flow
through the UI per entity: create, see it in the list, open the details, edit, delete. A test that
creates, changes or deletes data is tagged `@mutating` (it runs alone, after a reset of the mock);
read-only tests never depend on how many records exist. Add the list, the details page and the form
to the `@a11y` checks in `e2e/a11y.spec.ts`.

## Done

- [ ] Contract first; the mock implements it and its tests pass.
- [ ] Keys start with the root; mutations invalidate lists, details and other features' roots.
- [ ] `silent` on every mutation that a form or dialog explains; queries of lists stay loud.
- [ ] No imports between features; pages thin and verifying the session.
- [ ] Forms: `zodResolver`, `FormField`, `applyServerErrors`, focus on the first invalid field.
- [ ] List state in the URL through `useListParams`.
- [ ] Route, navigation item, loading state, 404 for a malformed id.
- [ ] Component tests as above; an e2e flow; no unhandled requests.
- [ ] Gates from the `verify` skill pass.
