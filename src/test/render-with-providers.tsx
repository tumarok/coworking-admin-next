import { QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, type RenderHookOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { makeQueryClient } from '@/lib/query-client';

/** The app's query client and a URL kept in memory, so a page can be tested as it is wired. */
const setup = (searchParams = '') => {
  const urls: string[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = ({ queryString }) => {
    urls.push(queryString);
  };
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
        {children}
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
  return { wrapper, queryClient, lastUrl: () => urls.at(-1) ?? '' };
};

export const renderWithProviders = (ui: React.ReactElement, { searchParams = '' } = {}) => {
  const { wrapper, queryClient, lastUrl } = setup(searchParams);
  return { ...render(ui, { wrapper }), user: userEvent.setup(), queryClient, lastUrl };
};

export const renderHookWithProviders = <Result,>(
  hook: () => Result,
  {
    searchParams = '',
    ...options
  }: { searchParams?: string } & Omit<RenderHookOptions<unknown>, 'wrapper'> = {},
) => {
  const { wrapper, queryClient, lastUrl } = setup(searchParams);
  return { ...renderHook(hook, { ...options, wrapper }), queryClient, lastUrl };
};
