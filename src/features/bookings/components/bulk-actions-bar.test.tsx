import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BulkActionsBar } from './bulk-actions-bar';

const handlers = () => ({ onConfirm: vi.fn(), onCancel: vi.fn(), onClear: vi.fn() });

const setup = (props: Partial<React.ComponentProps<typeof BulkActionsBar>> = {}) => {
  const calls = handlers();
  const ui = (next: Partial<React.ComponentProps<typeof BulkActionsBar>>) => (
    <BulkActionsBar count={3} running={null} {...calls} {...props} {...next} />
  );
  const view = render(ui({}));
  return {
    user: userEvent.setup(),
    ...calls,
    rerender: (next: Partial<React.ComponentProps<typeof BulkActionsBar>>) => {
      view.rerender(ui(next));
    },
  };
};

const confirmButton = () => screen.getByRole('button', { name: 'Confirm selected bookings' });
const cancelButton = () => screen.getByRole('button', { name: 'Cancel selected bookings' });

describe('BulkActionsBar', () => {
  it('says how many bookings are selected', () => {
    setup({ count: 1 });

    expect(screen.getByRole('toolbar', { name: 'Bulk actions' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 selected');
  });

  it('keeps its status line mounted while nothing is selected, so a change is announced', () => {
    const { rerender } = setup({ count: 0 });

    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();

    rerender({ count: 2 });
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('2 selected');
  });

  it('confirms, asks to cancel and clears through its own buttons', async () => {
    const { user, onConfirm, onCancel, onClear } = setup();

    await user.click(confirmButton());
    await user.click(cancelButton());
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('shows short labels and names what they act on', () => {
    setup();

    expect(confirmButton()).toHaveTextContent('Confirm');
    expect(cancelButton()).toHaveTextContent('Cancel');
  });

  it('allows the most one request takes', () => {
    setup({ count: 100 });

    expect(confirmButton()).toBeEnabled();
    expect(cancelButton()).toBeEnabled();
    expect(screen.queryByText(/Select up to/)).not.toBeInTheDocument();
  });

  it('turns both actions off above the limit and says why, in the status line', () => {
    setup({ count: 101 });

    const reason = screen.getByText('Select up to 100 bookings');
    expect(screen.getByRole('status')).toContainElement(reason);
    for (const button of [confirmButton(), cancelButton()]) {
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription('Select up to 100 bookings');
    }
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeEnabled();
  });

  it('waits for a running request: nothing can be pressed twice', () => {
    setup({ running: 'confirm' });

    for (const button of [
      confirmButton(),
      cancelButton(),
      screen.getByRole('button', { name: 'Clear selection' }),
    ]) {
      expect(button).toBeDisabled();
    }
  });
});
