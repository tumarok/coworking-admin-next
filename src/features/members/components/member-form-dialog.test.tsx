import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Member } from '@/lib/contract/member';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { MemberFormDialog } from './member-form-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const EXISTING: Member = {
  id: 'mem_1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '+380 44 123 45 67',
  company: 'Analytical Engines',
  plan: 'dedicated',
  status: 'suspended',
  joinedAt: '2026-01-31',
};

afterEach(() => {
  vi.clearAllMocks();
});

const setup = (member?: Member) => {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  const view = renderWithProviders(
    <MemberFormDialog open onOpenChange={onOpenChange} member={member} onSaved={onSaved} />,
  );
  return { ...view, onOpenChange, onSaved };
};

// The dialog moves the focus to its first field a moment after it opened; typing into another
// field before that would lose characters to the first one.
const focused = () =>
  waitFor(() => {
    expect(screen.getByRole('textbox', { name: /^First name/ })).toHaveFocus();
  });

const fillNew = async (user: ReturnType<typeof setup>['user']) => {
  await focused();
  await user.type(screen.getByRole('textbox', { name: /^First name/ }), 'Dana');
  await user.type(screen.getByRole('textbox', { name: /^Last name/ }), 'Testova');
  await user.type(screen.getByRole('textbox', { name: /^Email/ }), 'dana.testova@example.com');
  await user.type(screen.getByRole('textbox', { name: /^Phone/ }), '+380 44 000 00 00');
};

describe('MemberFormDialog: creating', () => {
  it('opens empty with the defaults of a new member', () => {
    setup();

    expect(screen.getByRole('dialog', { name: 'New member' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^First name/ })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveAttribute('type', 'email');
    expect(screen.getByRole('textbox', { name: /^Phone/ })).toHaveAttribute(
      'placeholder',
      '+380 44 123 45 67',
    );
    expect(screen.getByRole('combobox', { name: /^Plan/ })).toHaveTextContent('Flex');
    expect(screen.getByRole('combobox', { name: /^Status/ })).toHaveTextContent('Active');
  });

  it('marks the required fields and leaves the company optional', () => {
    setup();

    for (const name of [/^First name/, /^Last name/, /^Email/, /^Phone/]) {
      expect(screen.getByRole('textbox', { name })).toBeRequired();
    }
    expect(screen.getByRole('textbox', { name: /^Company/ })).not.toBeRequired();
  });

  it('saves, announces it, reports the new member and closes', async () => {
    installMockApi({ via: 'bff' });
    const { user, onSaved, onOpenChange } = setup();

    await fillNew(user);
    await user.type(screen.getByRole('textbox', { name: /^Company/ }), 'Test Studio');
    await user.click(screen.getByRole('combobox', { name: /^Plan/ }));
    await user.click(await screen.findByRole('option', { name: 'Team' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      firstName: 'Dana',
      lastName: 'Testova',
      email: 'dana.testova@example.com',
      company: 'Test Studio',
      plan: 'team',
      status: 'active',
      joinedAt: '2026-10-14',
    });
    expect(toast.success).toHaveBeenCalledWith('Member added', { description: 'Dana Testova' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('sends a blank company as none and a messy email trimmed and in lower case', async () => {
    const bodies: unknown[] = [];
    installMockApi({ via: 'bff' });
    server.use(
      http.post('*/bff/members', async ({ request }) => {
        bodies.push(await request.clone().json());
        return undefined;
      }),
    );
    const { user, onSaved } = setup();
    await fillNew(user);
    const email = screen.getByRole('textbox', { name: /^Email/ });
    await user.clear(email);
    await user.type(email, '  Dana.Testova@Example.COM ');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(bodies).toEqual([
      expect.objectContaining({ email: 'dana.testova@example.com', company: null }),
    ]);
  });

  it('shows the validation messages under the fields and sends nothing', async () => {
    const requests: string[] = [];
    server.use(
      http.post('*/bff/members', () => {
        requests.push('post');
        return HttpResponse.json({});
      }),
    );
    const { user } = setup();

    await focused();
    await user.type(screen.getByRole('textbox', { name: /^Email/ }), 'not-an-email');
    await user.type(screen.getByRole('textbox', { name: /^Phone/ }), 'call me');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findAllByText('Required')).toHaveLength(2);
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid phone number')).toBeInTheDocument();
    const first = screen.getByRole('textbox', { name: /^First name/ });
    expect(first).toBeInvalid();
    expect(screen.getByRole('textbox', { name: /^Email/ })).toBeInvalid();
    await waitFor(() => {
      expect(first).toHaveFocus();
    });
    expect(requests).toEqual([]);
  });
});

describe('MemberFormDialog: editing', () => {
  it('opens with the values of the member', () => {
    setup(EXISTING);

    expect(screen.getByRole('dialog', { name: 'Edit Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^First name/ })).toHaveValue('Ada');
    expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveValue('ada@example.com');
    expect(screen.getByRole('textbox', { name: /^Company/ })).toHaveValue('Analytical Engines');
    expect(screen.getByRole('combobox', { name: /^Plan/ })).toHaveTextContent('Dedicated');
    expect(screen.getByRole('combobox', { name: /^Status/ })).toHaveTextContent('Suspended');
  });

  it('shows a member without a company as an empty field', () => {
    setup({ ...EXISTING, company: null });

    expect(screen.getByRole('textbox', { name: /^Company/ })).toHaveValue('');
  });

  it('saves the change and says it was an update', async () => {
    const api = installMockApi({ via: 'bff' });
    const member = api.db.members[0];
    if (!member) throw new Error('seed lacks members');
    const { user, onSaved } = setup({ ...member, company: null });

    await focused();
    const last = screen.getByRole('textbox', { name: /^Last name/ });
    await user.clear(last);
    await user.type(last, 'Renamed');
    await user.click(screen.getByRole('combobox', { name: /^Status/ }));
    await user.click(await screen.findByRole('option', { name: 'Cancelled' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      id: member.id,
      lastName: 'Renamed',
      status: 'cancelled',
      company: null,
      joinedAt: member.joinedAt,
    });
    expect(toast.success).toHaveBeenCalledWith('Member updated', {
      description: `${member.firstName} Renamed`,
    });
  });

  it('starts from the saved values again after it was closed and reopened', async () => {
    function Reopen() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button
            onClick={() => {
              setOpen(true);
            }}
          >
            reopen
          </button>
          <MemberFormDialog open={open} onOpenChange={setOpen} member={EXISTING} />
        </>
      );
    }
    const { user } = renderWithProviders(<Reopen />);
    await user.type(screen.getByRole('textbox', { name: /^First name/ }), ' changed');

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'reopen' }));

    expect(await screen.findByRole('textbox', { name: /^First name/ })).toHaveValue('Ada');
  });
});

describe('MemberFormDialog: failures', () => {
  it('puts a duplicate email under the email field, focuses it and stays open', async () => {
    const api = installMockApi({ via: 'bff' });
    const taken = api.db.members[0]?.email;
    if (!taken) throw new Error('seed lacks members');
    const { user, onSaved, onOpenChange } = setup();
    await fillNew(user);
    const email = screen.getByRole('textbox', { name: /^Email/ });
    await user.clear(email);
    await user.type(email, taken.toUpperCase());

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('This email is already registered')).toBeInTheDocument();
    expect(email).toBeInvalid();
    await waitFor(() => {
      expect(email).toHaveFocus();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // The message sits under its field; the form has no banner of its own for it.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(email).toHaveAccessibleDescription('This email is already registered');
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('accepts the own email of the member when editing', async () => {
    const api = installMockApi({ via: 'bff' });
    const member = api.db.members[0];
    if (!member) throw new Error('seed lacks members');
    const { user, onSaved } = setup(member);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(screen.queryByText('This email is already registered')).not.toBeInTheDocument();
  });

  it('shows any other failure as an alert in the form, not as a toast', async () => {
    server.use(
      http.post('*/bff/members', () =>
        HttpResponse.json({ message: 'The server failed to save' }, { status: 500 }),
      ),
    );
    const { user, onOpenChange } = setup();
    await fillNew(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The server failed to save');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    // No field explains it, so the banner takes the focus from the button that was disabled.
    await waitFor(() => {
      expect(alert).toHaveFocus();
    });
  });

  it('can be saved again after a failure', async () => {
    let attempts = 0;
    installMockApi({ via: 'bff' });
    server.use(
      http.post('*/bff/members', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ message: 'The server failed to save' }, { status: 500 })
          : undefined;
      }),
    );
    const { user, onSaved } = setup();
    await fillNew(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('locks the form and ignores Escape while the save is running', async () => {
    installMockApi({ via: 'bff' });
    server.use(
      http.post('*/bff/members', async () => {
        await delay(150);
        return undefined;
      }),
    );
    const { user, onOpenChange, onSaved } = setup();
    await fillNew(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('textbox', { name: /^First name/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
  });
});
