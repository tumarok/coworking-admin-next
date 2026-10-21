import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormDialog, FormDialogFooter, FormError } from './form-dialog';

const setup = (props: Partial<React.ComponentProps<typeof FormDialog>> = {}) => {
  const onOpenChange = vi.fn();
  render(
    <FormDialog open onOpenChange={onOpenChange} title="New room" {...props}>
      <p>form body</p>
    </FormDialog>,
  );
  return { onOpenChange, user: userEvent.setup() };
};

describe('FormDialog', () => {
  it('is a dialog named by its title with the form inside', () => {
    setup({ description: 'Fill it in' });

    expect(screen.getByRole('dialog', { name: 'New room' })).toBeInTheDocument();
    expect(screen.getByText('form body')).toBeInTheDocument();
    expect(screen.getByText('Fill it in')).toBeInTheDocument();
  });

  it('asks to close on Escape', async () => {
    const { user, onOpenChange } = setup();

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ignores Escape and hides the close button while a save is running', async () => {
    const { user, onOpenChange } = setup({ pending: true });

    await user.keyboard('{Escape}');

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });
});

describe('FormDialogFooter', () => {
  it('cancels and submits', async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn((event: React.SyntheticEvent) => {
      event.preventDefault();
    });
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <FormDialogFooter pending={false} submitLabel="Save" onCancel={onCancel} />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('disables both buttons while saving', () => {
    render(<FormDialogFooter pending submitLabel="Save" onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('FormError', () => {
  it('is announced as an alert', () => {
    render(<FormError>Could not save</FormError>);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
  });
});
