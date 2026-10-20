import * as z from 'zod';

// Zod compiles schemas with `new Function` unless told otherwise. The CSP has no 'unsafe-eval', so
// Firefox would log a violation for every schema; the interpreted path behaves the same. This
// module is imported first in the providers, before any schema is used in the browser.
z.config({ jitless: true });
