export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertEnv } = await import('./instrumentation-node');
    await assertEnv();
  }
}
