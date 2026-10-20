import { afterEach, describe, expect, it, vi } from 'vitest';

const loadAssertEnv = async () => {
  vi.resetModules();
  return (await import('./instrumentation-node')).assertEnv;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('assertEnv', () => {
  it('lets a valid environment start', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await (
      await loadAssertEnv()
    )();

    expect(exit).not.toHaveBeenCalled();
  });

  it('stops the process once when the environment is invalid', async () => {
    vi.stubEnv('API_URL', 'not a url');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await (
      await loadAssertEnv()
    )();

    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('refusing to start'),
      expect.anything(),
    );
  });
});

describe('register', () => {
  it('validates the environment on the Node runtime only', async () => {
    vi.stubEnv('API_URL', 'not a url');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.resetModules();
    const { register } = await import('./instrumentation');

    vi.stubEnv('NEXT_RUNTIME', 'edge');
    await register();
    expect(exit).not.toHaveBeenCalled();

    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    await register();
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
});
