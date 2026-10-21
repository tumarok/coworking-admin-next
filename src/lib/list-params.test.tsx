import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderHookWithProviders } from '@/test/render-with-providers';
import { useListParams } from './list-params';

const FILTERS = ['status', 'type'] as const;
const render = (searchParams = '') =>
  renderHookWithProviders(() => useListParams(FILTERS), { searchParams });

describe('useListParams', () => {
  it('starts from the defaults', () => {
    const { result } = render();

    expect(result.current).toMatchObject({
      page: 1,
      limit: 20,
      q: '',
      filters: { status: '', type: '' },
      query: { page: 1, limit: 20 },
    });
  });

  it('reads the list state from the URL and builds the request query', () => {
    const { result } = render('?page=3&limit=50&q=loft&status=active');

    expect(result.current.query).toEqual({ page: 3, limit: 50, q: 'loft', status: 'active' });
  });

  it('treats a filter value outside the allowed ones as no filter', () => {
    const { result } = renderHookWithProviders(
      () => useListParams(FILTERS, { status: ['active', 'inactive'] }),
      { searchParams: '?status=bogus&type=loft' },
    );

    expect(result.current.filters).toEqual({ status: '', type: 'loft' });
    expect(result.current.query).toEqual({ page: 1, limit: 20, type: 'loft' });
  });

  it('keeps an allowed filter value', () => {
    const { result } = renderHookWithProviders(
      () => useListParams(FILTERS, { status: ['active', 'inactive'] }),
      { searchParams: '?status=inactive' },
    );

    expect(result.current.query).toMatchObject({ status: 'inactive' });
  });

  it.each([['?page=0'], ['?page=-4'], ['?page=abc']])('treats %s as page 1', (search) => {
    expect(render(search).result.current.page).toBe(1);
  });

  it.each([['?limit=0'], ['?limit=many'], ['?limit=-5'], ['?limit=500'], ['?limit=15']])(
    'falls back to the default page size for %s',
    (search) => {
      const { result } = render(search);

      expect(result.current.limit).toBe(20);
      expect(result.current.query.limit).toBe(20);
    },
  );

  it.each([10, 20, 50])('accepts the offered page size %i', (size) => {
    expect(render(`?limit=${size}`).result.current.limit).toBe(size);
  });

  it('treats a fractional page as a whole one', () => {
    expect(render('?page=2.7').result.current.page).toBe(2);
  });

  it('writes the page and leaves the default page out of the URL', async () => {
    const { result, lastUrl } = render();

    act(() => {
      void result.current.setPage(3);
    });
    await waitFor(() => {
      expect(lastUrl()).toBe('?page=3');
    });
    expect(result.current.page).toBe(3);

    act(() => {
      void result.current.setPage(1);
    });
    await waitFor(() => {
      expect(lastUrl()).toBe('');
    });
  });

  it('goes back to page 1 when the search changes', async () => {
    const { result, lastUrl } = render('?page=4');

    act(() => {
      void result.current.setSearch('loft');
    });

    await waitFor(() => {
      expect(lastUrl()).toBe('?q=loft');
    });
  });

  it('keeps the search as typed but sends it trimmed', async () => {
    const { result } = render();

    act(() => {
      void result.current.setSearch('open space ');
    });

    await waitFor(() => {
      expect(result.current.q).toBe('open space ');
    });
    expect(result.current.query.q).toBe('open space');
  });

  it('sends no search for a blank text', async () => {
    const { result } = render();

    act(() => {
      void result.current.setSearch('   ');
    });

    await waitFor(() => {
      expect(result.current.q).toBe('   ');
    });
    expect(result.current.query).toEqual({ page: 1, limit: 20 });
  });

  it('goes back to page 1 when a filter changes, and drops an emptied filter', async () => {
    const { result, lastUrl } = render('?page=2&status=active');

    act(() => {
      void result.current.setFilter('type', 'hot_desk');
    });
    await waitFor(() => {
      expect(lastUrl()).toBe('?status=active&type=hot_desk');
    });

    act(() => {
      void result.current.setFilter('status', null);
    });
    await waitFor(() => {
      expect(lastUrl()).toBe('?type=hot_desk');
    });
  });

  it('goes back to page 1 when the page size changes', async () => {
    const { result, lastUrl } = render('?page=5');

    act(() => {
      void result.current.setLimit(50);
    });

    await waitFor(() => {
      expect(lastUrl()).toBe('?limit=50');
    });
  });

  it('keeps the page size when the filters are reset', async () => {
    const { result, lastUrl } = render('?q=x&type=hot_desk&limit=50&page=2');

    act(() => {
      void result.current.reset();
    });

    await waitFor(() => {
      expect(lastUrl()).toBe('?limit=50');
    });
  });
});
