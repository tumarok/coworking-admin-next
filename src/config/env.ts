import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Validated server environment; importing this module fails fast when it is invalid.
 * `SKIP_ENV_VALIDATION` is honoured only while `next build` runs, so a leaked variable cannot
 * switch validation off at runtime.
 */
export const env = createEnv({
  server: {
    /** Origin of the REST API; the `/api/v1` prefix is added by `@/lib/server/backend`. */
    API_URL: z
      .url({ protocol: /^https?$/ })
      .refine((value) => {
        // Zod keeps checking after `url()` failed, so a non-URL must not throw here.
        const url = URL.parse(value);
        return !url || (/^\/+$/.test(url.pathname) && !url.search && !url.hash);
      }, 'Use the origin only, e.g. http://localhost:4010: the `/api/v1` prefix is added for you')
      .transform((value) => value.replace(/\/+$/, '')),
    COOKIE_SECURE: z.stringbool().default(isProduction),
  },
  shared: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },
  runtimeEnv: {
    API_URL: process.env.API_URL,
    COOKIE_SECURE: process.env.COOKIE_SECURE,
    NODE_ENV: process.env.NODE_ENV,
  },
  emptyStringAsUndefined: true,
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION && process.env.NEXT_PHASE === 'phase-production-build',
});
