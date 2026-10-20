import { Component, type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '@/features/auth/actions';
import { getQueryClient } from '@/lib/query-client';
import { LoginForm } from './login-form';

// The action is a server module: importing it for real would pull `server-only` into jsdom.
vi.mock('@/features/auth/actions', () => ({ login: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/api/client', () => ({ endSignOut: vi.fn() }));

const loginMock = vi.mocked(login);

const fill = async (user: ReturnType<typeof userEvent.setup>, email = 'alex@coworking.test') => {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), 'secret123');
};

/** Stands in for the error page: a redirect thrown by the action must reach the boundary. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? <p>left the page</p> : this.props.children;
  }
}

beforeEach(() => {
  loginMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LoginForm', () => {
  it('shows the sign-in heading, both fields and the demo account', () => {
    render(<LoginForm />);

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByText('Demo account: admin@coworking.test / demo1234')).toBeInTheDocument();
  });

  it('sends the credentials and the return page to the action', async () => {
    loginMock.mockResolvedValue({ ok: false, message: 'Invalid email or password' });
    const user = userEvent.setup();
    render(<LoginForm from="/rooms?page=2" />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(loginMock).toHaveBeenCalledExactlyOnceWith(
      { email: 'alex@coworking.test', password: 'secret123' },
      '/rooms?page=2',
    );
  });

  it('shows the refusal of the API inline, without a toast', async () => {
    loginMock.mockResolvedValue({ ok: false, message: 'Invalid email or password' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid email or password');
    for (const field of [screen.getByLabelText('Email'), screen.getByLabelText('Password')]) {
      expect(field).toHaveAttribute('aria-describedby', alert.id);
      expect(field).toBeInvalid();
    }
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('clears the message with the first edit', async () => {
    loginMock.mockResolvedValue({ ok: false, message: 'Invalid email or password' });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('alert');

    await user.type(screen.getByLabelText('Password'), '4');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('validates with the contract schema before it calls the action', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInvalid();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('keeps the fields read-only, not disabled, while the request runs', async () => {
    let finish: (value: { ok: false; message: string }) => void = () => undefined;
    loginMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<LoginForm />);
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('readonly');
    expect(email).toBeEnabled();
    expect(screen.getByLabelText('Password')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    expect(screen.getByRole('form', { name: 'Sign in' })).toHaveAttribute('aria-busy', 'true');

    finish({ ok: false, message: 'Invalid email or password' });
    await waitFor(() => {
      expect(screen.getByLabelText('Email')).not.toHaveAttribute('readonly');
    });
  });

  it('does not swallow the redirect of a successful login', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // What `redirect()` throws: Next recognises it by its digest.
    loginMock.mockRejectedValue(
      Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/rooms;307;' }),
    );
    const user = userEvent.setup();
    render(
      <Boundary>
        <LoginForm />
      </Boundary>,
    );

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('left the page')).toBeInTheDocument();
  });

  it('shows a generic message when the action itself fails', async () => {
    loginMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    render(<LoginForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Signing in failed. Try again.');
  });

  it('tells a visitor with an expired session, and drops the notice once there is an error', async () => {
    loginMock.mockResolvedValue({ ok: false, message: 'Invalid email or password' });
    const user = userEvent.setup();
    render(<LoginForm expired />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your session has expired. Sign in again.',
    );

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not show the notice for a normal visit', () => {
    render(<LoginForm />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows and hides the password on request', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    // One fixed name: the pressed state carries the rest, so it is not announced twice.
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('sends one login for a fast second submit', async () => {
    let finish: (value: { ok: false; message: string }) => void = () => undefined;
    loginMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<LoginForm />);
    await fill(user);

    const form = screen.getByRole('form', { name: 'Sign in' });
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(loginMock).toHaveBeenCalledTimes(1);

    // A transition that never ends would hold back the ones of later tests.
    finish({ ok: false, message: 'Invalid email or password' });
    await screen.findByRole('alert');
  });

  it('moves focus to the password after a refusal', async () => {
    loginMock.mockResolvedValue({ ok: false, message: 'Invalid email or password' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByRole('alert');
    await waitFor(() => {
      expect(screen.getByLabelText('Password')).toHaveFocus();
    });
  });

  it('drops what a request in flight during sign-out left in the cache', () => {
    getQueryClient().setQueryData(['previous-user'], { name: 'Alex' });

    render(<LoginForm />);

    expect(getQueryClient().getQueryData(['previous-user'])).toBeUndefined();
  });

  it('lets the 401 handler listen again once the login page shows', async () => {
    const { endSignOut } = await import('@/lib/api/client');

    render(<LoginForm />);

    expect(endSignOut).toHaveBeenCalled();
  });
});
