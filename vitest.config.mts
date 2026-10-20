import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

// Tests that need real Request/Response/cookies and no DOM run in the `server` project.
const SERVER_TESTS = [
  'src/app/**/route.test.ts',
  'src/proxy*.test.ts',
  'src/instrumentation*.test.ts',
  'src/lib/{server,auth}/**/*.test.ts',
  'src/**/*.server.test.ts',
  'server/**/*.test.ts',
];

export default defineConfig({
  // The compiler runs in tests the same way it runs in `next build` (`reactCompiler: true`).
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, ...SERVER_TESTS],
          setupFiles: ['./vitest.setup.ts', './vitest.setup.dom.ts'],
        },
      },
      {
        extends: true,
        // The marker package throws outside the `react-server` export condition. Enabling that
        // condition globally would swap React for its server build, so only this package is
        // replaced by its own empty module. In `unit` the real marker stays: a client test that
        // pulls in a server module fails, just like the Next build does.
        resolve: {
          alias: {
            'server-only': fileURLToPath(
              new URL('./node_modules/server-only/empty.js', import.meta.url),
            ),
          },
        },
        test: {
          name: 'server',
          environment: 'node',
          include: SERVER_TESTS,
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/components/ui/**',
        'src/app/**/{page,layout,not-found,error,loading,global-error}.tsx',
        'src/test/**',
        'src/proxy.ts',
        'src/instrumentation*.ts',
        '**/*.test.*',
        '**/*.d.ts',
      ],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 80 },
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
