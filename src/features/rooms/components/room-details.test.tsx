import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { RoomDetails } from './room-details';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => {
  installMockApi({ via: 'bff' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RoomDetails', () => {
  it('shows a placeholder while the room loads', () => {
    renderWithProviders(<RoomDetails id="room_7" />);

    expect(screen.getByRole('status', { name: 'Loading room' })).toBeInTheDocument();
  });

  it('shows the fields of the room, the location by name and the amenities as badges', async () => {
    renderWithProviders(<RoomDetails id="room_7" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Iris' })).toBeVisible();
    expect(screen.getByText('Private office at Riverside Hub')).toBeInTheDocument();
    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    const values = screen.getAllByRole('definition').map((value) => value.textContent);
    expect(Object.fromEntries(terms.map((term, index) => [term, values[index]]))).toEqual({
      Status: 'Available',
      Type: 'Private office',
      Location: 'Riverside Hub',
      Capacity: '5 seats',
      Rate: '€28.50 / hour',
      Amenities: 'Standing desksWhiteboardProjector',
    });
    const amenities = screen.getByRole('list', { name: 'Amenities' });
    expect(within(amenities).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Riverside Hub' })).toHaveAttribute(
      'href',
      '/locations/loc_1',
    );
    expect(screen.getByRole('link', { name: 'Rooms' })).toHaveAttribute('href', '/rooms');
  });

  it('explains an unknown room on the page, without a toast', async () => {
    renderWithProviders(<RoomDetails id="room_nope" />);

    expect(await screen.findByRole('heading', { name: 'Room not found' })).toBeVisible();
    expect(screen.getByText('It may have been deleted.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All rooms' })).toHaveAttribute('href', '/rooms');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows the message of any other failure and loads again on request', async () => {
    let failing = true;
    server.use(
      http.get('*/bff/rooms/room_7', () =>
        failing ? HttpResponse.json({ message: 'The server failed' }, { status: 500 }) : undefined,
      ),
    );
    const { user } = renderWithProviders(<RoomDetails id="room_7" />);

    expect(await screen.findByRole('heading', { name: 'Could not load the room' })).toBeVisible();
    expect(screen.getByText('The server failed')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Iris' })).toBeVisible();
  });

  it('edits the room in a dialog and shows the saved values', async () => {
    const { user } = renderWithProviders(<RoomDetails id="room_7" />);
    await screen.findByRole('heading', { name: 'Iris' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Iris' });
    const name = within(dialog).getByRole('textbox', { name: /^Name/ });
    await user.clear(name);
    await user.type(name, 'Iris East');
    const rate = within(dialog).getByRole('spinbutton', { name: /^Hourly rate/ });
    await user.clear(rate);
    await user.type(rate, '31.25');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'Iris East' })).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('€31.25 / hour')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Room updated', { description: 'Iris East' });
  });

  it('refuses to delete a room with upcoming bookings and stays on the page', async () => {
    const { user } = renderWithProviders(<RoomDetails id="room_6" />);
    await screen.findByRole('heading', { name: 'Granite' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Granite?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'This room has upcoming bookings; cancel them first',
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('keeps showing the room when a refetch in the background fails', async () => {
    const { queryClient } = renderWithProviders(<RoomDetails id="room_7" />);
    await screen.findByRole('heading', { name: 'Iris' });
    server.use(
      http.get('*/bff/rooms/room_7', () =>
        HttpResponse.json({ message: 'The server failed' }, { status: 500 }),
      ),
    );

    await queryClient.invalidateQueries({ queryKey: ['rooms'] });

    await waitFor(() => {
      expect(queryClient.getQueryState(['rooms', 'detail', 'room_7'])?.status).toBe('error');
    });
    expect(screen.getByRole('heading', { name: 'Iris' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Could not load the room' })).toBeNull();
  });

  it('deletes a room without bookings and goes back to the list', async () => {
    const { user } = renderWithProviders(<RoomDetails id="room_e" />);
    await screen.findByRole('heading', { name: 'Lumen' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/rooms');
    });
    expect(toast.success).toHaveBeenCalledWith('Room deleted', { description: 'Lumen' });
    expect(screen.getByRole('status', { name: 'Loading room' })).toBeInTheDocument();
  });

  it('does not ask for the room again once it is deleted', async () => {
    let reads = 0;
    server.use(
      http.get('*/bff/rooms/room_e', () => {
        reads += 1;
        return undefined;
      }),
    );
    const { user } = renderWithProviders(<RoomDetails id="room_e" />);
    await screen.findByRole('heading', { name: 'Lumen' });
    const readsBeforeDelete = reads;

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/rooms');
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(reads).toBe(readsBeforeDelete);
  });
});
