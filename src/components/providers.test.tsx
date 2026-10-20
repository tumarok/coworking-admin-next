import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { useQueryState } from 'nuqs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQueryClient } from '@/lib/query-client';
import { ignoreThemeScriptWarning, stubSystemTheme } from '@/test/theme';
import { Providers } from './providers';

// The Next adapter needs a mounted app router; the testing adapter keeps the URL in memory.
vi.mock('nuqs/adapters/next/app', async () => {
  const { NuqsTestingAdapter } = await import('nuqs/adapters/testing');
  return { NuqsAdapter: NuqsTestingAdapter };
});

beforeEach(() => {
  stubSystemTheme();
  ignoreThemeScriptWarning();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Probe() {
  const client = useQueryClient();
  const [q] = useQueryState('q');
  return (
    <p>
      {client === getQueryClient() ? 'shared client' : 'other client'}, q={String(q)}
    </p>
  );
}

describe('Providers', () => {
  it('gives the children the app query client and URL state', () => {
    render(
      <Providers>
        <Probe />
      </Providers>,
    );

    expect(screen.getByText('shared client, q=null')).toBeInTheDocument();
  });

  it('renders the same output again', () => {
    const { rerender } = render(
      <Providers>
        <Probe />
      </Providers>,
    );

    rerender(
      <Providers>
        <Probe />
      </Providers>,
    );

    expect(screen.getByText('shared client, q=null')).toBeInTheDocument();
  });
});
