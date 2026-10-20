import { afterEach, describe, expect, it, vi } from 'vitest';

// The environment is validated while the module loads, so each case loads it afresh.
const loadEnv = async () => {
  vi.resetModules();
  return (await import('./env')).env;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('env', () => {
  it('reads the API origin and the cookie flag', async () => {
    vi.stubEnv('API_URL', 'https://api.example.test');
    vi.stubEnv('COOKIE_SECURE', 'true');

    const env = await loadEnv();

    expect(env.API_URL).toBe('https://api.example.test');
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it('strips trailing slashes from the API origin', async () => {
    vi.stubEnv('API_URL', 'http://api.test:4010//');

    expect((await loadEnv()).API_URL).toBe('http://api.test:4010');
  });

  it.each([
    ['production', true],
    ['development', false],
  ])('defaults the cookie flag in %s to %s', async (nodeEnv, expected) => {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.stubEnv('COOKIE_SECURE', '');

    expect((await loadEnv()).COOKIE_SECURE).toBe(expected);
  });

  it.each([
    ['missing', ''],
    ['not a URL', 'api'],
    ['not http', 'ftp://api.test'],
    ['an origin with a path', 'http://api.test/api'],
    ['an origin with a query', 'http://api.test?x=1'],
  ])('refuses an API_URL that is %s', async (_name, value) => {
    vi.stubEnv('API_URL', value);

    await expect(loadEnv()).rejects.toThrow(/Invalid environment variables/);
  });

  it('refuses a cookie flag that is not a boolean', async () => {
    vi.stubEnv('COOKIE_SECURE', 'maybe');

    await expect(loadEnv()).rejects.toThrow(/Invalid environment variables/);
  });

  describe('SKIP_ENV_VALIDATION', () => {
    it('skips validation during `next build`', async () => {
      vi.stubEnv('API_URL', '');
      vi.stubEnv('SKIP_ENV_VALIDATION', '1');
      vi.stubEnv('NEXT_PHASE', 'phase-production-build');

      await expect(loadEnv()).resolves.toBeDefined();
    });

    it('is ignored at runtime', async () => {
      vi.stubEnv('API_URL', '');
      vi.stubEnv('SKIP_ENV_VALIDATION', '1');

      await expect(loadEnv()).rejects.toThrow(/Invalid environment variables/);
    });
  });
});
