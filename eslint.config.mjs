// ESLint flat config. Block order matters: later blocks win, and a block that declares a rule
// again REPLACES that rule's options instead of merging them. That is why the selectors and
// path lists below are shared constants and every override block lists what stays in force.
//
// Layout decisions enforced here:
// - One alias, `@/*` -> `src/*`; relative imports are `./` or a single `../`.
// - No barrel files, named exports (default exports only in Next special files and configs).
// - The API contract (Zod schemas and types, no Next dependencies) lives in `src/lib/contract`.
// - The mock API lives in `server/` (outside `src`, so the layer boundaries do not apply to it).
// - Layers: app -> features -> components -> lib -> config. Features never import each other.
import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';
import testingLibrary from 'eslint-plugin-testing-library';
import tseslint from 'typescript-eslint';

// The plugin is registered by eslint-config-next; reuse that instance instead of installing a
// second copy.
const reactHooks = nextVitals.find((config) => config.plugins?.['react-hooks'])?.plugins[
  'react-hooks'
];
if (!reactHooks) throw new Error('react-hooks plugin not found in eslint-config-next');

const TEST_FILES = ['**/*.test.{ts,tsx}', 'src/test/**'];
const CONFIG_FILES = ['*.config.{js,mjs,ts,mts}'];

// Guardrails: where each restricted construct is still allowed.
const FETCH_ALLOWED = ['src/lib/api/**', 'src/lib/server/**', 'src/app/bff/**', ...TEST_FILES];
const ENV_ALLOWED = [
  'src/config/env.ts',
  'src/instrumentation*.ts',
  'server/index.ts', // CLI entry of the mock API
  ...CONFIG_FILES,
];
const QUERY_KEY_ALLOWED = ['src/features/*/api/**', ...TEST_FILES];

const SELECTORS = {
  // Reading the environment in one place keeps validation fail-fast and the rest of the code
  // independent of it.
  processEnv: {
    selector: "MemberExpression[object.name='process'][property.name='env']",
    message: 'Read environment variables through `@/config/env` only.',
  },
  // Query keys come from the key factories of a feature, so invalidation never drifts.
  queryKeyLiteral: {
    selector: "Property[key.name='queryKey']",
    message: 'Define query keys in `features/*/api` and import them.',
  },
  // A form without a resolver skips the shared Zod validation.
  useFormWithoutResolver: {
    selector:
      "CallExpression[callee.name='useForm']:not(:has(ObjectExpression > Property[key.name='resolver']))",
    message: 'Pass a `resolver` to `useForm`.',
  },
  // The Zod namespace is imported as `import * as z from 'zod'` throughout.
  zodNamedImport: {
    selector:
      "ImportDeclaration[source.value='zod'][importKind!='type'] > :matches(ImportSpecifier[imported.name='z'], ImportDefaultSpecifier)",
    message: "Use `import * as z from 'zod'`.",
  },
};

const restrictSyntax = (...names) => ['error', ...names.map((name) => SELECTORS[name])];
const ALL_SELECTORS = Object.keys(SELECTORS);
const without = (...skipped) => ALL_SELECTORS.filter((name) => !skipped.includes(name));

const FETCH_MESSAGE =
  'Call the API through `lib/api` (or `lib/server`, `app/bff`): it parses errors, handles 401 and keeps the cache consistent.';

// Layers for eslint-plugin-boundaries. The first matching descriptor wins.
const ELEMENTS = [
  { type: 'app', pattern: 'src/app' },
  { type: 'feature', pattern: 'src/features/*', capture: ['feature'] },
  { type: 'components-ui', pattern: 'src/components/ui' },
  { type: 'components', pattern: 'src/components' },
  { type: 'lib', pattern: 'src/lib' },
  { type: 'config', pattern: 'src/config' },
  { type: 'test', pattern: 'src/test' },
];

// File categories (first match wins): feature data modules are importable by data modules only.
const FILES = [
  { category: 'test', pattern: TEST_FILES },
  { category: 'app-entry', pattern: 'src/{proxy,instrumentation}*.ts' },
  {
    category: 'feature-data',
    pattern: [
      'src/features/*/api/**',
      'src/features/*/*types.ts',
      'src/features/*/*schemas.ts',
      'src/features/*/*constants.ts',
    ],
  },
  { category: 'feature-ui', pattern: 'src/features/**' },
];

const ownFeature = { type: 'feature', captured: { feature: '{{ from.captured.feature }}' } };
const types = (...names) => ({ element: { type: names } });

export default defineConfig([
  js.configs.recommended,
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.{ts,tsx,mts}'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  { files: ['**/*.{js,mjs,cjs}'], extends: [tseslint.configs.disableTypeChecked] },
  {
    files: ['**/*.{ts,tsx,mts}'],
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true }],
    },
  },
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'react/no-unescaped-entities': ['error', { forbid: ['>', '"', '}'] }],
      // Named exports everywhere except Next special files and tool configs (below).
      'import/no-default-export': 'error',
    },
  },
  {
    files: ['src/app/**', ...CONFIG_FILES],
    rules: { 'import/no-default-export': 'off' },
  },
  // Rules of Hooks plus the React Compiler diagnostics.
  { rules: reactHooks.configs.flat['recommended-latest'].rules },

  // Guardrails.
  {
    rules: {
      'no-restricted-globals': ['error', { name: 'fetch', message: FETCH_MESSAGE }],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: FETCH_MESSAGE },
        { object: 'globalThis', property: 'fetch', message: FETCH_MESSAGE },
      ],
      'no-restricted-syntax': restrictSyntax(...ALL_SELECTORS),
      // Deep relative paths hide the layer an import comes from; use `@/`.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../../**'], message: 'Import through the `@/` alias instead of `../../`.' },
          ],
        },
      ],
    },
  },
  {
    files: FETCH_ALLOWED,
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    files: ENV_ALLOWED,
    rules: { 'no-restricted-syntax': restrictSyntax(...without('processEnv')) },
  },
  {
    files: QUERY_KEY_ALLOWED,
    rules: { 'no-restricted-syntax': restrictSyntax(...without('queryKeyLiteral')) },
  },
  // The mock API lives outside `src`, so it (and the test helper that serves it) cannot use the
  // `@/` alias and reaches the contract and the mock with relative paths.
  {
    files: ['server/**', 'src/test/mock-api.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  // shadcn code guards optional props defensively.
  {
    files: ['src/components/ui/**'],
    rules: { '@typescript-eslint/no-unnecessary-condition': 'off' },
  },

  // Layer boundaries.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': ELEMENTS,
      'boundaries/files': FILES,
      'boundaries/files-single-match': true,
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkInternals: true,
          policies: [
            {
              from: types('app'),
              allow: {
                to: types('app', 'feature', 'components', 'components-ui', 'lib', 'config'),
              },
            },
            // `proxy.ts` and `instrumentation*.ts` sit next to `app/` and may use the same layers.
            {
              from: { file: { categories: 'app-entry' } },
              allow: { to: types('feature', 'components', 'components-ui', 'lib', 'config') },
            },
            // Feature UI: own feature, shared components, lib and config; never another feature.
            {
              from: { element: { type: 'feature' }, file: { categories: 'feature-ui' } },
              allow: [
                { to: { element: ownFeature } },
                { to: types('components', 'components-ui', 'lib', 'config') },
              ],
            },
            // Feature data (api, types, schemas, constants): no UI, not even its own.
            {
              from: { element: { type: 'feature' }, file: { categories: 'feature-data' } },
              allow: [
                { to: { element: ownFeature, file: { categories: 'feature-data' } } },
                { to: types('lib', 'config') },
              ],
            },
            {
              from: types('components'),
              allow: { to: types('components', 'components-ui', 'lib', 'config') },
            },
            { from: types('components-ui'), allow: { to: types('components-ui', 'lib') } },
            { from: types('lib'), allow: { to: types('lib', 'config') } },
            { from: types('config'), allow: { to: types('config') } },
            // Tests and test helpers may import anything; production code never imports them.
            {
              from: { file: { categories: 'test' } },
              allow: {
                to: types('app', 'feature', 'components', 'components-ui', 'lib', 'config', 'test'),
              },
            },
          ],
        },
      ],
    },
  },

  ...pluginQuery.configs['flat/recommended'],
  {
    files: ['**/*.test.tsx'],
    extends: [testingLibrary.configs['flat/react']],
  },
  prettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'reports/**',
    'playwright-report/**',
    'test-results/**',
    'blob-report/**',
    'public/**',
    'next-env.d.ts',
    '.*/**',
  ]),
]);
