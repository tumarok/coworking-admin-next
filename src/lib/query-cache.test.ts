import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { replaceInLists } from './query-cache';

interface Row {
  id: string;
  name: string;
}

const page = (items: Row[]) => ({ items, total: items.length, page: 1, limit: 20 });

describe('replaceInLists', () => {
  it('replaces the record in every cached list and keeps the rest of the page', () => {
    const queryClient = new QueryClient();
    const updated: Row = { id: 'a', name: 'New' };
    const a = { id: 'a', name: 'Old' };
    const b = { id: 'b', name: 'Other' };
    queryClient.setQueryData(['things', 'list', { page: 1 }], page([a, b]));
    queryClient.setQueryData(['things', 'list', { page: 2, q: 'x' }], page([a]));

    replaceInLists(queryClient, { queryKey: ['things', 'list'] }, updated);

    expect(queryClient.getQueryData(['things', 'list', { page: 1 }])).toEqual(
      page([{ id: 'a', name: 'New' }, b]),
    );
    expect(queryClient.getQueryData(['things', 'list', { page: 2, q: 'x' }])).toEqual(
      page([{ id: 'a', name: 'New' }]),
    );
  });

  it('leaves lists without the record, other keys and missing lists alone', () => {
    const queryClient = new QueryClient();
    const updated: Row = { id: 'a', name: 'New' };
    const b = { id: 'b', name: 'Other' };
    queryClient.setQueryData(['things', 'list', { page: 1 }], page([b]));
    queryClient.setQueryData(['things', 'detail', 'a'], { id: 'a', name: 'Old' });

    replaceInLists(queryClient, { queryKey: ['things', 'list'] }, updated);

    expect(queryClient.getQueryData(['things', 'list', { page: 1 }])).toEqual(page([b]));
    expect(queryClient.getQueryData(['things', 'detail', 'a'])).toEqual({ id: 'a', name: 'Old' });
    expect(queryClient.getQueriesData({ queryKey: ['nothing'] })).toEqual([]);
  });
});
