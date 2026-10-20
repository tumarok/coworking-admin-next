/**
 * Imports the validated environment when the server starts. Without `process.exit` an invalid
 * environment would only log an error and the server would keep answering every request with 500.
 * It lives in its own file because `process.exit` in `instrumentation.ts` makes Turbopack warn
 * about the Edge runtime.
 */
export async function assertEnv() {
  try {
    await import('@/config/env');
  } catch (error) {
    console.error('Invalid environment variables: refusing to start.', error);
    process.exit(1);
  }
}
