import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

const renderDialog = (props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) => {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Delete room?"
      description="This cannot be undone."
      confirmLabel="Delete"
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onOpenChange, onConfirm, user: userEvent.setup() };
};

describe('ConfirmDialog', () => {
  it('names the question and the action', () => {
    renderDialog();

    expect(screen.getByRole('alertdialog', { name: 'Delete room?' })).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('runs the action on confirm without closing by itself', async () => {
    const { user, onConfirm, onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('asks to close on cancel', async () => {
    const { user, onConfirm, onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables both buttons while the action is pending', () => {
    renderDialog({ pending: true });

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('asks to close on Escape', async () => {
    const { user, onOpenChange } = renderDialog();

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ignores Escape and a click outside while the action is pending', async () => {
    const { user, onOpenChange } = renderDialog({ pending: true });

    await user.keyboard('{Escape}');
    await user.click(document.body);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('styles the confirm button by its kind', () => {
    const { unmount } = render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete?"
        description="Gone for good."
        confirmLabel="Delete"
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-primary');
    unmount();

    render(
      <ConfirmDialog
        open
        destructive
        onOpenChange={vi.fn()}
        title="Delete?"
        description="Gone for good."
        confirmLabel="Delete"
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('text-destructive');
  });

  it('renders nothing while closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('opens and closes with its `open` prop and can be destructive', () => {
    const props = {
      onOpenChange: vi.fn(),
      title: 'Cancel booking?',
      description: 'The member is notified.',
      confirmLabel: 'Cancel booking',
      onConfirm: vi.fn(),
    };
    const { rerender } = render(<ConfirmDialog open={false} {...props} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    rerender(<ConfirmDialog open destructive {...props} />);
    expect(screen.getByRole('alertdialog', { name: 'Cancel booking?' })).toBeInTheDocument();

    rerender(<ConfirmDialog open destructive {...props} />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
