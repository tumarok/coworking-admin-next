import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Page } from '@/lib/contract/common';

/**
 * Puts a saved record into every cached page that lists it, so a dialog opened from the list
 * shows the saved values at once instead of the old ones until the refetch lands. `lists` selects
 * the list queries of the feature (`{ queryKey: <name>Keys.lists() }`).
 */
export const replaceInLists = (
  queryClient: QueryClient,
  lists: { queryKey: QueryKey },
  record: { id: string },
) => {
  queryClient.setQueriesData<Page<{ id: string }>>(
    lists,
    (page) =>
      page && { ...page, items: page.items.map((item) => (item.id === record.id ? record : item)) },
  );
};
