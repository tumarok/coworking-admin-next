import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { logout } from '@/features/auth/actions';
import type { User } from '@/lib/contract/auth';
import { getQueryClient } from '@/lib/query-client';
import { UserMenu } from './user-menu';

// Unlike `user-menu.test.tsx`, the sign-out guard here is the real one: this checks that the
// Query cache is really empty by the time the action runs.
vi.mock('@/features/auth/actions', () => ({ logout: vi.fn() }));

const user: User = {
  id: 'usr_1',
  name: 'Alex Morgan',
  email: 'alex@coworking.test',
  role: 'admin',
};

describe('UserMenu sign-out', () => {
  it('has emptied the Query cache before the action runs', async () => {
    getQueryClient().setQueryData(['rooms'], [{ id: 'room_1' }]);
    let cacheDuringAction: unknown = 'not called';
    vi.mocked(logout).mockImplementation(() => {
      cacheDuringAction = getQueryClient().getQueryData(['rooms']);
      return new Promise<never>(() => undefined);
    });
    const events = userEvent.setup();
    render(<UserMenu user={user} />);

    await events.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(cacheDuringAction).toBeUndefined();
    });
  });
});
