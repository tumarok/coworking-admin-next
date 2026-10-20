import { vi } from 'vitest';

/** jsdom has no `matchMedia`; `dark` says whether the system prefers the dark scheme. */
export const stubSystemTheme = (dark = false) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    // next-themes still calls the legacy pair.
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

/**
 * next-themes renders the inline script that sets the theme before the first paint; React 19 warns
 * about a script in a client render, in development only. The script itself is meant to be there.
 */
export const ignoreThemeScriptWarning = () => {
  const log = console.error.bind(console);
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('script tag')) return;
    log(...args);
  });
};
