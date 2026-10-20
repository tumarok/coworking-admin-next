import { environmentManager, MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/errors';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { silent?: boolean };
    mutationMeta: { silent?: boolean };
  }
}

/**
 * Failed requests surface as a toast, unless the caller shows the error itself (`meta.silent`,
 * used by forms) or it is a 401, which signs the user out instead. The message doubles as the
 * toast id, so parallel requests failing for the same reason show one toast.
 */
const notifyError = (error: Error, meta: { silent?: boolean } | undefined) => {
  if (meta?.silent) return;
  if (error instanceof ApiError && error.status === 401) return;
  toast.error(error.message, { id: error.message });
};

export const makeQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        notifyError(error, query.meta);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) => {
        notifyError(error, mutation.meta);
      },
    }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

let browserClient: QueryClient | undefined;

/**
 * A new client for every server render (never share cached data between requests) and one per
 * browser tab. Not kept in `useState`: React may drop that state when the first render suspends.
 */
export const getQueryClient = () => {
  if (environmentManager.isServer()) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
};
