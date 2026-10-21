import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Location } from '@/lib/contract/location';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { LocationsList } from './locations-list';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => {
  installMockApi({ via: 'bff' });
});

afterEach(() => {
  vi.clearAllMocks();
});

const rowFor = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

/** Records the lists the API was asked for. */
const watchRequests = () => {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get('*/bff/locations', ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return undefined;
    }),
  );
  return queries;
};

describe('LocationsList', () => {
  it('shows the locations of the mock API with hours, rooms and status', async () => {
    renderWithProviders(<LocationsList />);

    expect(screen.getByRole('heading', { level: 1, name: 'Locations' })).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'Riverside Hub' });
    expect(link).toHaveAttribute('href', '/locations/loc_1');
    const row = rowFor('Riverside Hub');
    expect(within(row).getByText('Kyiv')).toBeInTheDocument();
    expect(within(row).getByText('08:00–21:00')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(within(rowFor('Harbour Studio')).getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('1–5 of 5')).toBeInTheDocument();
  });

  it('searches after a pause: one request, the text in the URL, only the match left', async () => {
    const queries = watchRequests();
    const { user, lastUrl } = renderWithProviders(<LocationsList />);
    await screen.findByRole('link', { name: 'Riverside Hub' });
    expect(queries).toHaveLength(1);

    await user.type(
      screen.getByRole('searchbox', { name: 'Search name, city or address' }),
      'lisbon',
    );

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Riverside Hub' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Harbour Studio' })).toBeInTheDocument();
    expect(lastUrl()).toBe('?q=lisbon');
    expect(queries).toHaveLength(2);
    expect(queries[1]?.get('q')).toBe('lisbon');
  });

  it('filters by status and clears the filters again', async () => {
    const { user, lastUrl } = renderWithProviders(<LocationsList />);
    await screen.findByRole('link', { name: 'Riverside Hub' });
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Inactive' }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Riverside Hub' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Harbour Studio' })).toBeInTheDocument();
    expect(lastUrl()).toBe('?status=inactive');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByRole('link', { name: 'Riverside Hub' })).toBeInTheDocument();
    expect(lastUrl()).toBe('');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Any status');
  });

  it('starts from the filters in the URL', async () => {
    renderWithProviders(<LocationsList />, { searchParams: '?q=berlin&status=active' });

    expect(await screen.findByRole('link', { name: 'Canal Yard' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('berlin');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Active');
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('ignores a status in the URL that the API does not know', async () => {
    renderWithProviders(<LocationsList />, { searchParams: '?status=bogus' });

    expect(await screen.findByRole('link', { name: 'Riverside Hub' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Any status');
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
  });

  it('says so when the filters match nothing', async () => {
    renderWithProviders(<LocationsList />, { searchParams: '?q=nowhere' });

    expect(await screen.findByText('No locations match the current filters.')).toBeInTheDocument();
  });

  it('says so when there are no locations at all', async () => {
    server.use(
      http.get('*/bff/locations', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 }),
      ),
    );
    renderWithProviders(<LocationsList />);

    expect(await screen.findByText('No locations yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('pages through a long list through the URL', async () => {
    const all: Location[] = Array.from({ length: 25 }, (_, index) => ({
      id: `loc_${index + 100}`,
      name: `Place ${index + 1}`,
      city: 'Kyiv',
      address: '1 Test Street',
      timezone: 'Europe/Kyiv',
      opensAt: '08:00',
      closesAt: '20:00',
      status: 'active',
      roomCount: 1,
    }));
    server.use(
      http.get('*/bff/locations', ({ request }) => {
        const params = new URL(request.url).searchParams;
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
    const { user, lastUrl } = renderWithProviders(<LocationsList />);
    await screen.findByRole('link', { name: 'Place 1' });

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByRole('link', { name: 'Place 21' })).toBeInTheDocument();
    expect(lastUrl()).toBe('?page=2');
    expect(screen.getByText('21–25 of 25')).toBeInTheDocument();
  });

  it('shows a failed load in the table and loads again on retry', async () => {
    let failing = true;
    server.use(
      http.get('*/bff/locations', () =>
        failing ? HttpResponse.json({ message: 'The server failed' }, { status: 500 }) : undefined,
      ),
    );
    const { user } = renderWithProviders(<LocationsList />);

    expect(await screen.findByText('The server failed')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('link', { name: 'Riverside Hub' })).toBeInTheDocument();
  });

  it('creates a location and opens its page', async () => {
    const { user } = renderWithProviders(<LocationsList />);
    await screen.findByRole('link', { name: 'Riverside Hub' });

    await user.click(screen.getByRole('button', { name: 'New location' }));
    const dialog = await screen.findByRole('dialog', { name: 'New location' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Garden Annex');
    await user.type(within(dialog).getByRole('textbox', { name: /^City/ }), 'Vienna');
    await user.type(within(dialog).getByRole('textbox', { name: /^Address/ }), '5 Ring Strasse');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledOnce();
    });
    expect(String(router.push.mock.calls[0]?.[0])).toMatch(/^\/locations\/loc_/);
    expect(toast.success).toHaveBeenCalledWith('Location created', { description: 'Garden Annex' });
  });

  it('edits a location from its row and the list shows the change', async () => {
    const { user } = renderWithProviders(<LocationsList />);
    await screen.findByRole('link', { name: 'Riverside Hub' });

    await user.click(screen.getByRole('button', { name: 'Edit Riverside Hub' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Riverside Hub' });
    const name = within(dialog).getByRole('textbox', { name: /^Name/ });
    expect(name).toHaveValue('Riverside Hub');
    await user.clear(name);
    await user.type(name, 'Riverside Hub East');
    fireEvent.change(within(dialog).getByLabelText(/^Closes at/), { target: { value: '22:00' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('link', { name: 'Riverside Hub East' })).toBeInTheDocument();
    expect(within(rowFor('Riverside Hub East')).getByText('08:00–22:00')).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens "New location" after an edit was dismissed, not the edited one', async () => {
    const { user } = renderWithProviders(<LocationsList />);
    await screen.findByRole('link', { name: 'Riverside Hub' });
    await user.click(screen.getByRole('button', { name: 'Edit Riverside Hub' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Edit Riverside Hub' })).getByRole(
        'button',
        { name: 'Cancel' },
      ),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'New location' }));

    const dialog = await screen.findByRole('dialog', { name: 'New location' });
    expect(within(dialog).getByRole('textbox', { name: /^Name/ })).toHaveValue('');
  });

  it('refuses to delete a location with rooms and says why', async () => {
    const { user } = renderWithProviders(<LocationsList />);
    await screen.findByRole('link', { name: 'Riverside Hub' });

    await user.click(screen.getByRole('button', { name: 'Delete Riverside Hub' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Riverside Hub?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Remove or move the rooms of this location first',
    );
    // The page behind a modal dialog is hidden from assistive technology, but it is still there.
    expect(screen.getByRole('link', { name: 'Riverside Hub', hidden: true })).toBeInTheDocument();
  });

  it('deletes a location and drops its row', async () => {
    const { user } = renderWithProviders(<LocationsList />);
    await screen.findByRole('link', { name: 'Riverside Hub' });
    let removed = false;
    server.use(
      http.delete('*/bff/locations/loc_1', () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('*/bff/locations', () =>
        removed ? HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 }) : undefined,
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Delete Riverside Hub' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Riverside Hub' })).not.toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith('Location deleted', {
      description: 'Riverside Hub',
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
