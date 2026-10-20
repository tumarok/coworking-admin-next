import { Component, type ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logout } from '@/features/auth/actions';
import { beginSignOut, endSignOut } from '@/lib/api/client';
import type { User } from '@/lib/contract/auth';
import { UserMenu } from './user-menu';

vi.mock('@/features/auth/actions', () => ({ logout: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ beginSignOut: vi.fn(), endSignOut: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const user: User = {
  id: 'usr_1',
  name: 'Alex Morgan',
  email: 'alex@coworking.test',
  role: 'admin',
};
const calls: string[] = [];

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
  calls.length = 0;
  vi.mocked(beginSignOut).mockImplementation(() => calls.push('begin'));
  vi.mocked(endSignOut).mockImplementation(() => calls.push('end'));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('UserMenu', () => {
  it('shows who is signed in', () => {
    render(<UserMenu user={user} />);

    expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('silences the 401 handler before it signs out', async () => {
    let finish: () => void = () => undefined;
    vi.mocked(logout).mockImplementation(() => {
      calls.push('logout');
      return new Promise<never>((resolve) => {
        finish = () => {
          resolve(undefined as never);
        };
      });
    });
    const events = userEvent.setup();
    render(<UserMenu user={user} />);

    await events.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(calls).toEqual(['begin', 'logout']);
    });
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled();

    // A transition that never ends would hold back the ones of later tests.
    await act(async () => {
      finish();
      await Promise.resolve();
    });
  });

  it('listens for 401 again and says so when signing out fails', async () => {
    vi.mocked(logout).mockRejectedValue(new Error('network down'));
    const events = userEvent.setup();
    render(<UserMenu user={user} />);

    await events.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Could not sign out. Try again.');
    });
    expect(calls).toEqual(['begin', 'end']);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
    });
  });

  it('does not swallow the redirect to the login page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // What `redirect()` throws: Next recognises it by its digest.
    vi.mocked(logout).mockRejectedValue(
      Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login;307;' }),
    );
    const events = userEvent.setup();
    render(
      <Boundary>
        <UserMenu user={user} />
      </Boundary>,
    );

    await events.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('left the page')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(calls).toEqual(['begin']);
  });
});
