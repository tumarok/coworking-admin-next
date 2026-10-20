import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ignoreThemeScriptWarning, stubSystemTheme } from '@/test/theme';
import { AppHeader } from './app-header';

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }));

beforeEach(() => {
  stubSystemTheme();
  ignoreThemeScriptWarning();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AppHeader', () => {
  it('is the page banner and holds the theme toggle', () => {
    render(<AppHeader />);

    expect(screen.getByRole('banner')).toContainElement(
      screen.getByRole('button', { name: 'Toggle dark mode' }),
    );
  });

  it('shows the account area after the theme toggle', () => {
    render(
      <AppHeader>
        <button type="button">Account</button>
      </AppHeader>,
    );

    expect(screen.getByRole('banner')).toContainElement(
      screen.getByRole('button', { name: 'Account' }),
    );
  });
});
