import { screen, waitFor } from '@testing-library/react';
import { delay, http } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memberFullName, type Member } from '@/lib/contract/member';
import { installMockApi } from '@/test/mock-api';
import { seededMembers } from '@/test/mock-members';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { DeleteMemberDialog } from './delete-member-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let api: ReturnType<typeof installMockApi>;
let seeded: ReturnType<typeof seededMembers>;

beforeEach(() => {
  api = installMockApi({ via: 'bff' });
  seeded = seededMembers(api);
});

afterEach(() => {
  vi.clearAllMocks();
});

const setup = (target: Member | null, open = target !== null) => {
  const onOpenChange = vi.fn();
  const onDeleted = vi.fn();
  const view = renderWithProviders(
    <DeleteMemberDialog
      member={target}
      open={open}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
    />,
  );
  return { ...view, onOpenChange, onDeleted };
};

describe('DeleteMemberDialog', () => {
  it('stays closed without a member', () => {
    setup(null);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('stays closed while `open` is false, even though the owner still holds the member', () => {
    setup(seeded.free, false);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('names the member in the question', () => {
    setup(seeded.free);

    expect(
      screen.getByRole('alertdialog', { name: `Delete ${memberFullName(seeded.free)}?` }),
    ).toBeInTheDocument();
  });

  it('deletes, announces it, closes and reports the deletion', async () => {
    const { free } = seeded;
    const { user, onOpenChange, onDeleted } = setup(free);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(toast.success).toHaveBeenCalledWith('Member removed', {
      description: memberFullName(free),
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(api.db.members.some((m) => m.id === free.id)).toBe(false);
  });

  it('keeps the dialog open and shows the answer of the API when bookings are upcoming', async () => {
    const { user, onOpenChange, onDeleted } = setup(seeded.booked);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This member has upcoming bookings; cancel them first',
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('forgets the error when the dialog is dismissed', async () => {
    const { user, onOpenChange } = setup(seeded.booked);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables the buttons while the request runs', async () => {
    server.use(
      http.delete('*/bff/members/*', async () => {
        await delay(150);
        return undefined;
      }),
    );
    const { user } = setup(seeded.free);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    });
  });
});
