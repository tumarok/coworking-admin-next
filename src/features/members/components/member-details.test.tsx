import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memberFullName } from '@/lib/contract/member';
import { formatDate } from '@/lib/format-date';
import { humanize } from '@/lib/humanize';
import { installMockApi } from '@/test/mock-api';
import { seededMembers } from '@/test/mock-members';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { MemberDetails } from './member-details';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

let seeded: ReturnType<typeof seededMembers>;

beforeEach(() => {
  seeded = seededMembers(installMockApi({ via: 'bff' }));
});

afterEach(() => {
  vi.clearAllMocks();
});

const name = memberFullName;

const fields = () => {
  const terms = screen.getAllByRole('term').map((term) => term.textContent);
  const values = screen.getAllByRole('definition').map((value) => value.textContent);
  return Object.fromEntries(terms.map((term, index) => [term, values[index]]));
};

describe('MemberDetails', () => {
  it('shows a placeholder while the member loads', () => {
    renderWithProviders(<MemberDetails id={seeded.booked.id} />);

    expect(screen.getByRole('status', { name: 'Loading member' })).toBeInTheDocument();
  });

  it('shows the fields of the member and their company as the subtitle', async () => {
    const member = seeded.withCompany;
    renderWithProviders(<MemberDetails id={member.id} />);

    expect(await screen.findByRole('heading', { level: 1, name: name(member) })).toBeVisible();
    expect(screen.getAllByText(member.company ?? '')).toHaveLength(2);
    expect(fields()).toEqual({
      Status: humanize(member.status),
      Plan: humanize(member.plan),
      Email: member.email,
      Phone: member.phone,
      Company: member.company,
      'Member since': formatDate(member.joinedAt),
    });
    expect(screen.getByRole('link', { name: member.email })).toHaveAttribute(
      'href',
      `mailto:${member.email}`,
    );
    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute('href', '/members');
  });

  it('shows a dash for a missing company and has no subtitle', async () => {
    const member = seeded.noCompany;
    renderWithProviders(<MemberDetails id={member.id} />);

    expect(await screen.findByRole('heading', { level: 1, name: name(member) })).toBeVisible();
    expect(fields()).toMatchObject({ Plan: humanize(member.plan), Company: '—' });
  });

  it('explains an unknown member on the page, without a toast', async () => {
    renderWithProviders(<MemberDetails id="mem_nope" />);

    expect(await screen.findByRole('heading', { name: 'Member not found' })).toBeVisible();
    expect(screen.getByText('They may have been removed.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All members' })).toHaveAttribute('href', '/members');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows the message of any other failure and loads again on request', async () => {
    const { booked } = seeded;
    let failing = true;
    server.use(
      http.get(`*/bff/members/${booked.id}`, () =>
        failing ? HttpResponse.json({ message: 'The server failed' }, { status: 500 }) : undefined,
      ),
    );
    const { user } = renderWithProviders(<MemberDetails id={booked.id} />);

    expect(await screen.findByRole('heading', { name: 'Could not load the member' })).toBeVisible();
    expect(screen.getByText('The server failed')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: name(booked) })).toBeVisible();
  });

  it('edits the member in a dialog and shows the saved values', async () => {
    const member = seeded.withCompany;
    const { user } = renderWithProviders(<MemberDetails id={member.id} />);
    await screen.findByRole('heading', { name: name(member) });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: `Edit ${name(member)}` });
    // The dialog focuses its first field a moment after it opened; wait, or it takes the focus back.
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox', { name: /^First name/ })).toHaveFocus();
    });
    await user.clear(within(dialog).getByRole('textbox', { name: /^Company/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fields().Company).toBe('—');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith('Member updated', { description: name(member) });
  });

  it('refuses to delete a member with upcoming bookings and stays on the page', async () => {
    const { booked } = seeded;
    const { user } = renderWithProviders(<MemberDetails id={booked.id} />);
    await screen.findByRole('heading', { name: name(booked) });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: `Delete ${name(booked)}?` });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'This member has upcoming bookings; cancel them first',
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('keeps showing the member when a refetch in the background fails', async () => {
    const { booked } = seeded;
    const { queryClient } = renderWithProviders(<MemberDetails id={booked.id} />);
    await screen.findByRole('heading', { name: name(booked) });
    server.use(
      http.get(`*/bff/members/${booked.id}`, () =>
        HttpResponse.json({ message: 'The server failed' }, { status: 500 }),
      ),
    );

    await queryClient.invalidateQueries({ queryKey: ['members'] });

    await waitFor(() => {
      expect(queryClient.getQueryState(['members', 'detail', booked.id])?.status).toBe('error');
    });
    expect(screen.getByRole('heading', { name: name(booked) })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Could not load the member' })).toBeNull();
  });

  it('deletes a member without upcoming bookings and goes back to the list', async () => {
    const { free } = seeded;
    const { user } = renderWithProviders(<MemberDetails id={free.id} />);
    await screen.findByRole('heading', { name: name(free) });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/members');
    });
    expect(toast.success).toHaveBeenCalledWith('Member removed', { description: name(free) });
    expect(screen.getByRole('status', { name: 'Loading member' })).toBeInTheDocument();
  });

  it('does not ask for the member again once they are deleted', async () => {
    const { free } = seeded;
    let reads = 0;
    server.use(
      http.get(`*/bff/members/${free.id}`, () => {
        reads += 1;
        return undefined;
      }),
    );
    const { user } = renderWithProviders(<MemberDetails id={free.id} />);
    await screen.findByRole('heading', { name: name(free) });
    const readsBeforeDelete = reads;

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/members');
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(reads).toBe(readsBeforeDelete);
  });
});
