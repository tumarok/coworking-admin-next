import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'next-themes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ignoreThemeScriptWarning, stubSystemTheme } from '@/test/theme';
import { ThemeToggle } from './theme-toggle';

const renderToggle = () =>
  render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeToggle />
    </ThemeProvider>,
  );

beforeEach(() => {
  ignoreThemeScriptWarning();
  localStorage.clear();
  document.documentElement.className = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ThemeToggle', () => {
  it('switches a light system to dark and back', async () => {
    stubSystemTheme();
    renderToggle();
    const toggle = screen.getByRole('button', { name: 'Toggle dark mode' });

    await userEvent.click(toggle);
    expect(document.documentElement).toHaveClass('dark');

    await userEvent.click(toggle);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('switches a dark system to light', async () => {
    stubSystemTheme(true);
    renderToggle();

    await userEvent.click(screen.getByRole('button', { name: 'Toggle dark mode' }));

    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement).toHaveClass('light');
  });

  it('renders the same output again', () => {
    stubSystemTheme();
    const { rerender } = renderToggle();

    rerender(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Toggle dark mode' })).toBeInTheDocument();
  });
});
