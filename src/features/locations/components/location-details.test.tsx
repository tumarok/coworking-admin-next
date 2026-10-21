import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { LocationDetails } from './location-details';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => {
  installMockApi({ via: 'bff' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LocationDetails', () => {
  it('shows a placeholder while the location loads', () => {
    renderWithProviders(<LocationDetails id="loc_1" />);

    expect(screen.getByRole('status', { name: 'Loading location' })).toBeInTheDocument();
  });

  it('shows the fields of the location', async () => {
    renderWithProviders(<LocationDetails id="loc_1" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Riverside Hub' })).toBeVisible();
    expect(screen.getByText('12 Naberezhna St, Kyiv')).toBeInTheDocument();
    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    const values = screen.getAllByRole('definition').map((value) => value.textContent);
    const field = Object.fromEntries(terms.map((term, index) => [term, values[index]]));
    expect(field).toMatchObject({
      Status: 'Active',
      City: 'Kyiv',
      'Time zone': 'Europe/Kyiv',
      'Opening hours': '08:00–21:00',
    });
    expect(Number(field.Rooms)).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Locations' })).toHaveAttribute('href', '/locations');
  });

  it('explains an unknown location on the page, without a toast', async () => {
    renderWithProviders(<LocationDetails id="loc_nope" />);

    expect(await screen.findByRole('heading', { name: 'Location not found' })).toBeVisible();
    expect(screen.getByText('It may have been deleted.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All locations' })).toHaveAttribute(
      'href',
      '/locations',
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows the message of any other failure and loads again on request', async () => {
    let failing = true;
    server.use(
      http.get('*/bff/locations/loc_1', () =>
        failing ? HttpResponse.json({ message: 'The server failed' }, { status: 500 }) : undefined,
      ),
    );
    const { user } = renderWithProviders(<LocationDetails id="loc_1" />);

    expect(
      await screen.findByRole('heading', { name: 'Could not load the location' }),
    ).toBeVisible();
    expect(screen.getByText('The server failed')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Riverside Hub' })).toBeVisible();
  });

  it('edits the location in a dialog and shows the saved values', async () => {
    const { user } = renderWithProviders(<LocationDetails id="loc_1" />);
    await screen.findByRole('heading', { name: 'Riverside Hub' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Riverside Hub' });
    const name = within(dialog).getByRole('textbox', { name: /^Name/ });
    await user.clear(name);
    await user.type(name, 'Riverside Hub East');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'Riverside Hub East' })).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith('Location updated', {
      description: 'Riverside Hub East',
    });
  });

  it('refuses to delete a location that still has rooms and stays on the page', async () => {
    const { user } = renderWithProviders(<LocationDetails id="loc_1" />);
    await screen.findByRole('heading', { name: 'Riverside Hub' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Riverside Hub?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Remove or move the rooms of this location first',
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('keeps showing the location when a refetch in the background fails', async () => {
    const { queryClient } = renderWithProviders(<LocationDetails id="loc_1" />);
    await screen.findByRole('heading', { name: 'Riverside Hub' });
    server.use(
      http.get('*/bff/locations/loc_1', () =>
        HttpResponse.json({ message: 'The server failed' }, { status: 500 }),
      ),
    );

    await queryClient.invalidateQueries({ queryKey: ['locations'] });

    await waitFor(() => {
      expect(queryClient.getQueryState(['locations', 'detail', 'loc_1'])?.status).toBe('error');
    });
    expect(screen.getByRole('heading', { name: 'Riverside Hub' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Could not load the location' })).toBeNull();
  });

  it('deletes an empty location and goes back to the list', async () => {
    const { user } = renderWithProviders(<LocationDetails id="loc_1" />);
    server.use(http.delete('*/bff/locations/loc_1', () => new HttpResponse(null, { status: 204 })));
    await screen.findByRole('heading', { name: 'Riverside Hub' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/locations');
    });
    expect(toast.success).toHaveBeenCalledWith('Location deleted', {
      description: 'Riverside Hub',
    });
    expect(screen.getByRole('status', { name: 'Loading location' })).toBeInTheDocument();
  });

  it('does not ask for the location again once it is deleted', async () => {
    let reads = 0;
    server.use(
      http.get('*/bff/locations/loc_1', () => {
        reads += 1;
        return undefined;
      }),
      http.delete('*/bff/locations/loc_1', () => new HttpResponse(null, { status: 204 })),
    );
    const { user } = renderWithProviders(<LocationDetails id="loc_1" />);
    await screen.findByRole('heading', { name: 'Riverside Hub' });
    const readsBeforeDelete = reads;

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/locations');
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(reads).toBe(readsBeforeDelete);
  });
});
