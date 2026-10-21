import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BulkFailedDialog } from './bulk-failed-dialog';

const failures = [
  {
    id: 'bk_1',
    subject: 'Atrium, 12 Oct 2026, 09:00–10:00',
    reason: 'Booking not found',
    gone: true,
  },
  {
    id: 'bk_2',
    subject: 'Loft, 12 Oct 2026, 11:00–12:00',
    reason: 'Cannot confirm a booking that is completed',
    gone: false,
  },
];

describe('BulkFailedDialog', () => {
  it('names the action in the title and each booking with its reason', () => {
    render(<BulkFailedDialog open onOpenChange={vi.fn()} action="confirm" failures={failures} />);

    const dialog = screen.getByRole('dialog', { name: 'Some bookings were not confirmed' });
    const items = within(dialog).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByRole('link')).toHaveAccessibleName(
      'Atrium, 12 Oct 2026, 09:00–10:00 (opens in a new tab)',
    );
    expect(within(items[0] as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/bookings/bk_1',
    );
    expect(
      within(items[1] as HTMLElement).getByText('Cannot confirm a booking that is completed'),
    ).toBeInTheDocument();
  });

  it('says "cancelled" for a cancel', () => {
    render(
      <BulkFailedDialog
        open
        onOpenChange={vi.fn()}
        action="cancel"
        failures={failures.slice(0, 1)}
      />,
    );

    expect(
      screen.getByRole('dialog', { name: 'Some bookings were not cancelled' }),
    ).toBeInTheDocument();
  });

  it('closes with its Close button, and has exactly one', async () => {
    const onOpenChange = vi.fn();
    render(
      <BulkFailedDialog open onOpenChange={onOpenChange} action="confirm" failures={failures} />,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });

  it('says what became of the selection: nothing left it, all left it, or only the gone ones', () => {
    const { rerender } = render(
      <BulkFailedDialog
        open
        onOpenChange={vi.fn()}
        action="confirm"
        failures={failures.slice(1)}
      />,
    );
    expect(
      screen.getByText('They are still selected, so you can look at them or try again.'),
    ).toBeInTheDocument();

    rerender(
      <BulkFailedDialog
        open
        onOpenChange={vi.fn()}
        action="confirm"
        failures={failures.slice(0, 1)}
      />,
    );
    expect(
      screen.getByText('They no longer exist, so they were taken off the selection.'),
    ).toBeInTheDocument();

    rerender(<BulkFailedDialog open onOpenChange={vi.fn()} action="confirm" failures={failures} />);
    expect(
      screen.getByText(
        'Bookings that no longer exist were taken off the selection; the others are still selected.',
      ),
    ).toBeInTheDocument();
  });
});
