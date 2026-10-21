import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { RoomsList } from './rooms-list';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => {
  installMockApi({ via: 'bff' });
});

afterEach(() => {
  vi.clearAllMocks();
});

const rowFor = (name: RegExp) => screen.getByRole('row', { name });

/** Records the lists the API was asked for. */
const watchRequests = () => {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get('*/bff/rooms', ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return undefined;
    }),
  );
  return queries;
};

describe('RoomsList', () => {
  it('shows the rooms of the mock API with location, type, seats, rate, amenities and status', async () => {
    renderWithProviders(<RoomsList />);

    expect(screen.getByRole('heading', { level: 1, name: 'Rooms' })).toBeInTheDocument();
    const links = await screen.findAllByRole('link', { name: 'Cedar' });
    expect(links[0]).toHaveAttribute('href', '/rooms/room_u');
    const row = rowFor(/^Cedar Canal Yard/);
    expect(within(row).getByText('Meeting room')).toBeInTheDocument();
    expect(within(row).getByText('12 seats')).toBeInTheDocument();
    expect(within(row).getByText('€25.00 / hour')).toBeInTheDocument();
    expect(within(row).getByText('Video conferencing')).toBeInTheDocument();
    expect(within(row).getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('1–20 of 32')).toBeInTheDocument();
  });

  it('pages through the list through the URL', async () => {
    const { user, lastUrl } = renderWithProviders(<RoomsList />);
    await screen.findAllByRole('link', { name: 'Cedar' });

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByRole('link', { name: 'Harbor' })).toBeInTheDocument();
    expect(lastUrl()).toBe('?page=2');
    expect(screen.getByText('21–32 of 32')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(13);
  });

  it('searches after a pause: one request, the text in the URL, only the match left', async () => {
    const queries = watchRequests();
    const { user, lastUrl } = renderWithProviders(<RoomsList />);
    await screen.findAllByRole('link', { name: 'Cedar' });
    expect(queries).toHaveLength(1);

    await user.type(screen.getByRole('searchbox', { name: 'Search name or location' }), 'aurora');

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(2);
    });
    expect(screen.getByRole('link', { name: 'Aurora' })).toBeInTheDocument();
    expect(lastUrl()).toBe('?q=aurora');
    expect(queries).toHaveLength(2);
    expect(queries[1]?.get('q')).toBe('aurora');
  });

  it('filters by a location found with the search and clears the filters again', async () => {
    const queries = watchRequests();
    const { user, lastUrl } = renderWithProviders(<RoomsList />);
    await screen.findAllByRole('link', { name: 'Cedar' });
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

    const location = screen.getByRole('combobox', { name: 'Location' });
    await user.click(location);
    await user.type(location, 'riverside');
    await user.click(await screen.findByRole('option', { name: 'Riverside Hub (Kyiv)' }));

    await waitFor(() => {
      expect(screen.getByText('1–7 of 7')).toBeInTheDocument();
    });
    expect(lastUrl()).toBe('?locationId=loc_1');
    expect(queries.at(-1)?.get('locationId')).toBe('loc_1');
    expect(screen.getByRole('link', { name: 'Granite' })).toBeInTheDocument();
    expect(location).toHaveValue('Riverside Hub (Kyiv)');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      expect(screen.getByText('1–20 of 32')).toBeInTheDocument();
    });
    expect(lastUrl()).toBe('');
    expect(location).toHaveValue('');
  });

  it('filters by type and by status', async () => {
    const { user, lastUrl } = renderWithProviders(<RoomsList />);
    await screen.findAllByRole('link', { name: 'Cedar' });

    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByRole('option', { name: 'Hot desk' }));

    await waitFor(() => {
      expect(screen.getByText('1–5 of 5')).toBeInTheDocument();
    });
    expect(lastUrl()).toBe('?type=hot_desk');

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Maintenance' }));

    await waitFor(() => {
      expect(screen.getByText('1–1 of 1')).toBeInTheDocument();
    });
    expect(lastUrl()).toBe('?type=hot_desk&status=maintenance');
    expect(screen.getByRole('link', { name: 'Kestrel' })).toBeInTheDocument();
  });

  it('starts from the filters in the URL and names the chosen location', async () => {
    renderWithProviders(<RoomsList />, {
      searchParams: '?locationId=loc_3&type=meeting_room',
    });

    expect(await screen.findByRole('link', { name: 'Iris' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Meeting room');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Any status');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Location' })).toHaveValue(
        'Old Mill Works (Kraków)',
      );
    });
  });

  it('names a location id it cannot find as unknown and shows no rooms for it', async () => {
    renderWithProviders(<RoomsList />, { searchParams: '?locationId=junk' });

    expect(await screen.findByText('No rooms match the current filters.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Location' })).toHaveValue('Unknown location');
    });
    expect(screen.getByRole('combobox', { name: 'Location' })).toBeInvalid();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('gives the filter its own button names', () => {
    renderWithProviders(<RoomsList />, { searchParams: '?locationId=loc_1' });

    expect(screen.getByRole('button', { name: 'Show filter locations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear location filter' })).toBeInTheDocument();
  });

  it('ignores a type and a status in the URL that the API does not know', async () => {
    renderWithProviders(<RoomsList />, { searchParams: '?type=bogus&status=nope' });

    expect(await screen.findAllByRole('link', { name: 'Cedar' })).not.toHaveLength(0);
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Any type');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Any status');
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
  });

  it('says so when the filters match nothing', async () => {
    renderWithProviders(<RoomsList />, { searchParams: '?q=nowhere' });

    expect(await screen.findByText('No rooms match the current filters.')).toBeInTheDocument();
  });

  it('says so when there are no rooms at all', async () => {
    server.use(
      http.get('*/bff/rooms', () => HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 })),
    );
    renderWithProviders(<RoomsList />);

    expect(await screen.findByText('No rooms yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows a failed load in the table and loads again on retry', async () => {
    let failing = true;
    server.use(
      http.get('*/bff/rooms', () =>
        failing ? HttpResponse.json({ message: 'The server failed' }, { status: 500 }) : undefined,
      ),
    );
    const { user } = renderWithProviders(<RoomsList />);

    expect(await screen.findByText('The server failed')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect((await screen.findAllByRole('link', { name: 'Cedar' })).length).toBeGreaterThan(0);
  });

  it('creates a room with a searched location and opens its page', async () => {
    const { user } = renderWithProviders(<RoomsList />);
    await screen.findAllByRole('link', { name: 'Cedar' });

    await user.click(screen.getByRole('button', { name: 'New room' }));
    const dialog = await screen.findByRole('dialog', { name: 'New room' });
    const location = within(dialog).getByRole('combobox', { name: /^Location/ });
    await user.click(location);
    await user.type(location, 'market');
    await user.click(await screen.findByRole('option', { name: 'Market Square Loft (Lviv)' }));
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Garden Annex');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledOnce();
    });
    expect(String(router.push.mock.calls[0]?.[0])).toMatch(/^\/rooms\/room_/);
    expect(toast.success).toHaveBeenCalledWith('Room created', { description: 'Garden Annex' });
  });

  it('edits a room from its row and the list shows the change', async () => {
    const { user } = renderWithProviders(<RoomsList />, { searchParams: '?q=aurora' });
    await screen.findByRole('link', { name: 'Aurora' });

    await user.click(screen.getByRole('button', { name: 'Edit Aurora' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Aurora' });
    const name = within(dialog).getByRole('textbox', { name: /^Name/ });
    expect(name).toHaveValue('Aurora');
    await user.clear(name);
    await user.type(name, 'Aurora East');
    const rate = within(dialog).getByRole('spinbutton', { name: /^Hourly rate/ });
    expect(rate).toHaveValue(34.5);
    await user.clear(rate);
    await user.type(rate, '40');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('link', { name: 'Aurora East' })).toBeInTheDocument();
    expect(within(rowFor(/Aurora East/)).getByText('€40.00 / hour')).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens "New room" after an edit was dismissed, not the edited one', async () => {
    const { user } = renderWithProviders(<RoomsList />, { searchParams: '?q=aurora' });
    await screen.findByRole('link', { name: 'Aurora' });
    await user.click(screen.getByRole('button', { name: 'Edit Aurora' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Edit Aurora' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'New room' }));

    const dialog = await screen.findByRole('dialog', { name: 'New room' });
    expect(within(dialog).getByRole('textbox', { name: /^Name/ })).toHaveValue('');
  });

  it('refuses to delete a room with upcoming bookings and says why', async () => {
    const { user } = renderWithProviders(<RoomsList />, { searchParams: '?q=aurora' });
    await screen.findByRole('link', { name: 'Aurora' });

    await user.click(screen.getByRole('button', { name: 'Delete Aurora' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Aurora?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'This room has upcoming bookings; cancel them first',
    );
    // The page behind a modal dialog is hidden from assistive technology, but it is still there.
    expect(screen.getByRole('link', { name: 'Aurora', hidden: true })).toBeInTheDocument();
  });

  it('deletes a room without bookings and drops its row', async () => {
    const { user } = renderWithProviders(<RoomsList />, {
      searchParams: '?locationId=loc_2&type=meeting_room&status=maintenance',
    });
    await screen.findByRole('link', { name: 'Lumen' });

    await user.click(screen.getByRole('button', { name: 'Delete Lumen' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Lumen' })).not.toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith('Room deleted', { description: 'Lumen' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
