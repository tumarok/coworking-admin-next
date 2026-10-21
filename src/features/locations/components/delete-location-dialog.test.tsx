import { screen, waitFor } from '@testing-library/react';
import { delay, http } from 'msw';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Location } from '@/lib/contract/location';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { DeleteLocationDialog } from './delete-location-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const location = (id: string, name: string): Location => ({
  id,
  name,
  city: 'Kyiv',
  address: '12 Naberezhna St',
  timezone: 'Europe/Kyiv',
  opensAt: '08:00',
  closesAt: '21:00',
  status: 'active',
  roomCount: 0,
});

afterEach(() => {
  vi.clearAllMocks();
});

const setup = (target: Location | null, open = target !== null) => {
  const onOpenChange = vi.fn();
  const onDeleted = vi.fn();
  const view = renderWithProviders(
    <DeleteLocationDialog
      location={target}
      open={open}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
    />,
  );
  return { ...view, onOpenChange, onDeleted };
};

describe('DeleteLocationDialog', () => {
  it('stays closed without a location', () => {
    setup(null);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('stays closed while `open` is false, even though the owner still holds the location', () => {
    setup(location('loc_1', 'Riverside Hub'), false);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('names the location in the question', () => {
    setup(location('loc_1', 'Riverside Hub'));

    expect(screen.getByRole('alertdialog', { name: 'Delete Riverside Hub?' })).toBeInTheDocument();
  });

  it('deletes, announces it, closes and reports the deletion', async () => {
    const api = installMockApi({ via: 'bff' });
    const { roomCount: _roomCount, ...record } = location('loc_empty', 'Garden Annex');
    api.db.locations.push(record);
    const { user, onOpenChange, onDeleted } = setup(location('loc_empty', 'Garden Annex'));

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(toast.success).toHaveBeenCalledWith('Location deleted', { description: 'Garden Annex' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(api.db.locations.some((l) => l.id === 'loc_empty')).toBe(false);
  });

  it('keeps the dialog open and shows the answer of the API when rooms are left', async () => {
    installMockApi({ via: 'bff' });
    const { user, onOpenChange, onDeleted } = setup(location('loc_1', 'Riverside Hub'));

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Remove or move the rooms of this location first',
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('forgets the error when the dialog is dismissed', async () => {
    installMockApi({ via: 'bff' });
    const { user, onOpenChange } = setup(location('loc_1', 'Riverside Hub'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables the buttons while the request runs', async () => {
    installMockApi({ via: 'bff' });
    server.use(
      http.delete('*/bff/locations/*', async () => {
        await delay(150);
        return undefined;
      }),
    );
    const { user } = setup(location('loc_1', 'Riverside Hub'));

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    });
  });
});
