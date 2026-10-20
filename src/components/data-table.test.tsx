import { useQuery } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import * as z from 'zod';
import { describe, expect, it } from 'vitest';
import { api } from '@/lib/api/client';
import { pageOf } from '@/lib/contract/common';
import { useListParams } from '@/lib/list-params';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { DataTable, dataTableColumns } from './data-table';

const itemSchema = z.object({ id: z.string(), name: z.string() });
type Item = z.infer<typeof itemSchema>;
const listSchema = pageOf(itemSchema);

const column = dataTableColumns<Item>();
const columns = column.columns([
  column.accessor('name', { header: 'Name' }),
  column.display({
    id: 'shout',
    header: 'Shout',
    cell: ({ row }) => row.original.name.toUpperCase(),
  }),
]);

const ALL = Array.from({ length: 45 }, (_, index) => ({
  id: `i${index + 1}`,
  name: `Item ${index + 1}`,
}));

/** Serves `ALL` page by page and counts the requests that arrive. */
const serveItems = (all: Item[] = ALL) => {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get('*/bff/items', ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      const page = Number(params.get('page'));
      const limit = Number(params.get('limit'));
      return HttpResponse.json({
        items: all.slice((page - 1) * limit, page * limit),
        total: all.length,
        page,
        limit,
      });
    }),
  );
  return requests;
};

/** A list screen wired the way the feature pages are: URL state -> query -> table. */
function Harness({
  selectable = false,
  labelRows = true,
  empty,
}: {
  selectable?: boolean;
  labelRows?: boolean;
  empty?: string;
}) {
  const params = useListParams();
  const [selected, setSelected] = useState({});
  const items = useQuery({
    queryKey: ['items', params.query],
    queryFn: ({ signal }) => api.get('items', listSchema, { query: params.query, signal }),
    placeholderData: (previous) => previous,
  });
  return (
    <DataTable
      caption="Items"
      columns={columns}
      rows={items.data?.items}
      total={items.data?.total ?? 0}
      page={params.page}
      limit={params.limit}
      onPageChange={(page) => void params.setPage(page)}
      onLimitChange={(limit) => void params.setLimit(limit)}
      fetching={items.isFetching}
      error={items.error}
      onRetry={() => void items.refetch()}
      {...(labelRows && { rowLabel: (row: Item) => row.name })}
      {...(empty && { empty })}
      {...(selectable && { selection: { state: selected, onChange: setSelected } })}
    />
  );
}

describe('DataTable', () => {
  it('shows skeleton rows while the first page loads, then the rows', async () => {
    serveItems();
    renderWithProviders(<Harness />);

    expect(screen.getByRole('table', { name: 'Items' })).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByRole('cell', { name: 'Item 1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'ITEM 1' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Items' })).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('1–20 of 45')).toBeInTheDocument();
  });

  it('writes the page to the URL and makes exactly one request per page change', async () => {
    const requests = serveItems();
    const { user, lastUrl } = renderWithProviders(<Harness />);
    await screen.findByRole('cell', { name: 'Item 1' });
    expect(requests).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByRole('cell', { name: 'Item 21' })).toBeInTheDocument();
    await waitFor(() => {
      expect(lastUrl()).toBe('?page=2');
    });
    expect(requests).toHaveLength(2);
    expect(requests[1]?.get('page')).toBe('2');
    expect(screen.getByText('21–40 of 45')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('starts from the page in the URL and disables the edges', async () => {
    serveItems();
    renderWithProviders(<Harness />, { searchParams: '?page=3' });

    expect(await screen.findByRole('cell', { name: 'Item 41' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Last page' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'First page' })).toBeEnabled();
  });

  it('keeps the focus on a page button that becomes disabled', async () => {
    serveItems();
    const { user } = renderWithProviders(<Harness />, { searchParams: '?page=2' });
    await screen.findByRole('cell', { name: 'Item 21' });
    const next = screen.getByRole('button', { name: 'Next page' });

    next.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('cell', { name: 'Item 41' })).toBeInTheDocument();
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute('aria-disabled', 'true');

    await user.click(next);
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
  });

  it('jumps to the first and last page', async () => {
    serveItems();
    const { user, lastUrl } = renderWithProviders(<Harness />, { searchParams: '?page=2' });
    await screen.findByRole('cell', { name: 'Item 21' });

    await user.click(screen.getByRole('button', { name: 'Last page' }));
    await waitFor(() => {
      expect(lastUrl()).toBe('?page=3');
    });

    await user.click(screen.getByRole('button', { name: 'First page' }));
    await waitFor(() => {
      expect(lastUrl()).toBe('');
    });
    expect(await screen.findByRole('cell', { name: 'Item 1' })).toBeInTheDocument();
  });

  it('returns to page 1 when the page size changes', async () => {
    const requests = serveItems();
    const { user, lastUrl } = renderWithProviders(<Harness />, { searchParams: '?page=3' });
    await screen.findByRole('cell', { name: 'Item 41' });

    await user.click(screen.getByRole('combobox', { name: 'Rows per page' }));
    await user.click(await screen.findByRole('option', { name: '10' }));

    await waitFor(() => {
      expect(lastUrl()).toBe('?limit=10');
    });
    expect(await screen.findByRole('cell', { name: 'Item 1' })).toBeInTheDocument();
    expect(requests.at(-1)?.get('page')).toBe('1');
    expect(requests.at(-1)?.get('limit')).toBe('10');
    expect(screen.getByText('1–10 of 45')).toBeInTheDocument();
  });

  it('shows the empty message when there are no rows', async () => {
    serveItems([]);
    renderWithProviders(<Harness />);

    expect(await screen.findByText('No results.')).toBeInTheDocument();
    expect(screen.getByText('0–0 of 0')).toBeInTheDocument();
  });

  it('shows a custom empty message', async () => {
    serveItems([]);
    renderWithProviders(<Harness empty="No items yet." />);

    expect(await screen.findByText('No items yet.')).toBeInTheDocument();
  });

  it('shows the error with a retry instead of loading forever when the first load fails', async () => {
    let fail = true;
    server.use(
      http.get('*/bff/items', () =>
        fail
          ? HttpResponse.json({ message: 'Items are unavailable' }, { status: 500 })
          : HttpResponse.json({ items: ALL.slice(0, 20), total: 45, page: 1, limit: 20 }),
      ),
    );
    const { user } = renderWithProviders(<Harness />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Items are unavailable');
    expect(screen.getByRole('table', { name: 'Items' })).toHaveAttribute('aria-busy', 'false');

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('cell', { name: 'Item 1' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('goes to the last page when the URL points past the end', async () => {
    const requests = serveItems();
    const { lastUrl } = renderWithProviders(<Harness />, { searchParams: '?page=9' });

    expect(await screen.findByRole('cell', { name: 'Item 41' })).toBeInTheDocument();
    await waitFor(() => {
      expect(lastUrl()).toBe('?page=3');
    });
    expect(requests.map((params) => params.get('page'))).toEqual(['9', '3']);
    expect(screen.getByText('41–45 of 45')).toBeInTheDocument();
    expect(screen.queryByText(/161/)).not.toBeInTheDocument();
  });

  describe('row selection', () => {
    it('has no checkboxes unless asked for', async () => {
      serveItems();
      renderWithProviders(<Harness />);
      await screen.findByRole('cell', { name: 'Item 1' });

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    // A row's name is its cell text; the numbered item is told apart from Item 10 to 19 by the end.
    const checkboxOf = (n: number) =>
      within(screen.getByRole('row', { name: new RegExp(`Item ${n} ITEM ${n}$`) })).getByRole(
        'checkbox',
      );
    const checkedRows = () =>
      screen.queryAllByRole('checkbox', { checked: true, name: /^Select Item / });

    it('selects single rows and all rows of the page', async () => {
      serveItems();
      const { user } = renderWithProviders(<Harness selectable />);
      await screen.findByRole('cell', { name: 'Item 1' });
      const all = screen.getByRole('checkbox', { name: 'Select all rows on this page' });
      expect(screen.getAllByRole('checkbox', { name: /^Select Item / })).toHaveLength(20);

      await user.click(checkboxOf(1));
      expect(checkboxOf(1)).toBeChecked();
      expect(all).toBePartiallyChecked();

      await user.click(all);
      expect(checkedRows()).toHaveLength(20);
      expect(all).toBeChecked();

      await user.click(all);
      expect(checkedRows()).toHaveLength(0);
    });

    it('keeps the selection by row id across a page change', async () => {
      serveItems();
      const { user } = renderWithProviders(<Harness selectable />);
      await screen.findByRole('cell', { name: 'Item 1' });
      await user.click(checkboxOf(1));

      await user.click(screen.getByRole('button', { name: 'Next page' }));
      await screen.findByRole('cell', { name: 'Item 21' });
      expect(checkedRows()).toHaveLength(0);

      await user.click(screen.getByRole('button', { name: 'Previous page' }));
      await screen.findByRole('cell', { name: 'Item 1' });
      expect(checkboxOf(1)).toBeChecked();
    });

    it('names each row checkbox after its row', async () => {
      serveItems();
      renderWithProviders(<Harness selectable />);
      await screen.findByRole('cell', { name: 'Item 1' });

      expect(screen.getByRole('checkbox', { name: 'Select Item 1' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Select Item 20' })).toBeInTheDocument();
    });

    it('falls back to a generic checkbox name without a row label', async () => {
      serveItems();
      renderWithProviders(<Harness selectable labelRows={false} />);
      await screen.findByRole('cell', { name: 'Item 1' });

      expect(screen.getAllByRole('checkbox', { name: 'Select row' })).toHaveLength(20);
    });

    it('marks a selected row', async () => {
      serveItems();
      const { user } = renderWithProviders(<Harness selectable />);
      await screen.findByRole('cell', { name: 'Item 1' });

      await user.click(checkboxOf(1));

      expect(screen.getByRole('row', { name: /Item 1 ITEM 1$/ })).toHaveAttribute(
        'data-state',
        'selected',
      );
    });
  });
});
