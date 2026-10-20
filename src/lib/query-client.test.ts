import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { getQueryClient, makeQueryClient } from './query-client';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

afterEach(() => {
  vi.mocked(toast.error).mockClear();
});

const failQuery = (client: QueryClient, error: Error, meta?: { silent?: boolean }) =>
  client.query({
    queryKey: ['failing', error],
    queryFn: () => Promise.reject(error),
    ...(meta && { meta }),
  });

describe('makeQueryClient', () => {
  it('shows a failed query as a toast keyed by its message', async () => {
    await failQuery(makeQueryClient(), new ApiError(500, { message: 'Boom' })).catch(() => {});

    expect(toast.error).toHaveBeenCalledWith('Boom', { id: 'Boom' });
  });

  it('shows a failed mutation as a toast', async () => {
    const client = makeQueryClient();

    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(new ApiError(409, { message: 'Taken' })) })
      .execute(undefined)
      .catch(() => {});

    expect(toast.error).toHaveBeenCalledWith('Taken', { id: 'Taken' });
  });

  it('stays quiet when the caller shows the error itself', async () => {
    const client = makeQueryClient();

    await failQuery(client, new Error('x'), { silent: true }).catch(() => {});
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(new Error('x')), meta: { silent: true } })
      .execute(undefined)
      .catch(() => {});

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('stays quiet on a 401, which signs the user out instead', async () => {
    await failQuery(makeQueryClient(), new ApiError(401, { message: 'Expired' })).catch(() => {});

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does not retry and keeps data fresh for a while', () => {
    const { queries, mutations } = makeQueryClient().getDefaultOptions();

    expect(queries).toMatchObject({
      retry: false,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    });
    expect(mutations).toMatchObject({ retry: false });
  });
});

describe('getQueryClient in the browser', () => {
  it('returns the same client every time', () => {
    expect(getQueryClient()).toBe(getQueryClient());
  });
});
