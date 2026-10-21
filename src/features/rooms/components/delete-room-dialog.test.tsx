import { screen, waitFor } from '@testing-library/react';
import { delay, http } from 'msw';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@/lib/contract/room';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { DeleteRoomDialog } from './delete-room-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const room = (id: string, name: string): Room => ({
  id,
  locationId: 'loc_1',
  locationName: 'Riverside Hub',
  name,
  type: 'meeting_room',
  capacity: 6,
  hourlyRate: 2500,
  amenities: [],
  status: 'available',
});

afterEach(() => {
  vi.clearAllMocks();
});

const setup = (target: Room | null, open = target !== null) => {
  const onOpenChange = vi.fn();
  const onDeleted = vi.fn();
  const view = renderWithProviders(
    <DeleteRoomDialog
      room={target}
      open={open}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
    />,
  );
  return { ...view, onOpenChange, onDeleted };
};

describe('DeleteRoomDialog', () => {
  it('stays closed without a room', () => {
    setup(null);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('stays closed while `open` is false, even though the owner still holds the room', () => {
    setup(room('room_e', 'Lumen'), false);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('names the room in the question', () => {
    setup(room('room_e', 'Lumen'));

    expect(screen.getByRole('alertdialog', { name: 'Delete Lumen?' })).toBeInTheDocument();
  });

  it('deletes, announces it, closes and reports the deletion', async () => {
    const api = installMockApi({ via: 'bff' });
    const { user, onOpenChange, onDeleted } = setup(room('room_e', 'Lumen'));

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(toast.success).toHaveBeenCalledWith('Room deleted', { description: 'Lumen' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(api.db.rooms.some((r) => r.id === 'room_e')).toBe(false);
  });

  it('keeps the dialog open and shows the answer of the API when bookings are upcoming', async () => {
    installMockApi({ via: 'bff' });
    const { user, onOpenChange, onDeleted } = setup(room('room_6', 'Granite'));

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This room has upcoming bookings; cancel them first',
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('forgets the error when the dialog is dismissed', async () => {
    installMockApi({ via: 'bff' });
    const { user, onOpenChange } = setup(room('room_6', 'Granite'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables the buttons while the request runs', async () => {
    installMockApi({ via: 'bff' });
    server.use(
      http.delete('*/bff/rooms/*', async () => {
        await delay(150);
        return undefined;
      }),
    );
    const { user } = setup(room('room_6', 'Granite'));

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    });
  });
});
