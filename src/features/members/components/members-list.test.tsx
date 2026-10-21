import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memberFullName } from '@/lib/contract/member';
import { formatDate } from '@/lib/format-date';
import { humanize } from '@/lib/humanize';
import { useFakeDebounce } from '@/test/debounce';
import { installMockApi } from '@/test/mock-api';
import { rangeText, seededMembers } from '@/test/mock-members';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { MembersList } from './members-list';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

let seeded: ReturnType<typeof seededMembers>;
let total: number;

beforeEach(() => {
  const api = installMockApi({ via: 'bff' });
  seeded = seededMembers(api);
  total = api.db.members.length;
});

afterEach(() => {
  vi.clearAllMocks();
});

const named = (member: { firstName: string; lastName: string }) => memberFullName(member);
const rowFor = (member: { firstName: string; lastName: string }) =>
  screen.getByRole('row', { name: new RegExp(`^${named(member)}`) });

/** Records the lists the API was asked for. */
const watchRequests = () => {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get('*/bff/members', ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return undefined;
    }),
  );
  return queries;
};

describe('MembersList', () => {
  it('shows the members of the mock API with email, company, plan, join date and status', async () => {
    const { withCompany: member } = seeded;
    renderWithProviders(<MembersList />);

    expect(screen.getByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: named(member) });
    expect(link).toHaveAttribute('href', `/members/${member.id}`);
    const row = rowFor(member);
    expect(within(row).getByText(member.email)).toBeInTheDocument();
    expect(within(row).getByText(member.company ?? '')).toBeInTheDocument();
    expect(within(row).getByText(humanize(member.plan))).toBeInTheDocument();
    expect(within(row).getByText(formatDate(member.joinedAt))).toBeInTheDocument();
    expect(within(row).getByText(humanize(member.status))).toBeInTheDocument();
    expect(screen.getByText(rangeText(total))).toBeInTheDocument();
  });

  it('shows a dash for a member without a company', async () => {
    renderWithProviders(<MembersList />);

    await screen.findByRole('link', { name: named(seeded.noCompany) });

    expect(within(rowFor(seeded.noCompany)).getByText('—')).toBeInTheDocument();
  });

  it('lists the members by last name, then first name', async () => {
    renderWithProviders(<MembersList />);
    await screen.findByRole('link', { name: named(seeded.first) });

    const names = screen.getAllByRole('link').map((link) => link.textContent);

    expect(names).toEqual(seeded.page.map(named));
  });

  it('pages through the list through the URL', async () => {
    const [second] = seeded.all.slice(20);
    if (!second) throw new Error('the seed has no second page');
    const { user, lastUrl } = renderWithProviders(<MembersList />);
    await screen.findByRole('link', { name: named(seeded.first) });

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByRole('link', { name: named(second) })).toBeInTheDocument();
    expect(lastUrl()).toBe('?page=2');
    expect(screen.getByText(rangeText(total, 20, 2))).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: named(seeded.first) })).not.toBeInTheDocument();
  });

  it('searches after a pause: one request, the text in the URL, only the match left', async () => {
    const queries = watchRequests();
    const { user, pause } = useFakeDebounce();
    const { lastUrl } = renderWithProviders(<MembersList />);
    const { first } = seeded;
    await screen.findByRole('link', { name: named(first) });
    expect(queries).toHaveLength(1);

    await user.type(
      screen.getByRole('searchbox', { name: 'Search name, email or company' }),
      first.email,
    );
    expect(queries).toHaveLength(1);
    pause();

    expect(await screen.findByText(rangeText(1))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: named(first) })).toBeInTheDocument();
    expect(lastUrl()).toBe(`?q=${first.email}`);
    expect(queries).toHaveLength(2);
    expect(queries[1]?.get('q')).toBe(first.email);
  });

  it('filters by plan and by status and clears the filters again', async () => {
    const suspended = seeded.all.filter((m) => m.status === 'suspended');
    const plan = suspended[0]?.plan;
    if (!plan) throw new Error('the seed has no suspended member');
    const ofPlan = seeded.all.filter((m) => m.plan === plan);
    const both = ofPlan.filter((m) => m.status === 'suspended');
    const queries = watchRequests();
    const { user, lastUrl } = renderWithProviders(<MembersList />);
    await screen.findByRole('link', { name: named(seeded.first) });
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Plan' }));
    await user.click(await screen.findByRole('option', { name: humanize(plan) }));

    expect(await screen.findByText(rangeText(ofPlan.length))).toBeInTheDocument();
    expect(lastUrl()).toBe(`?plan=${plan}`);
    expect(queries.at(-1)?.get('plan')).toBe(plan);

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Suspended' }));

    expect(await screen.findByText(rangeText(both.length))).toBeInTheDocument();
    expect(lastUrl()).toBe(`?plan=${plan}&status=suspended`);
    expect(queries.at(-1)?.get('status')).toBe('suspended');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText(rangeText(total))).toBeInTheDocument();
    expect(lastUrl()).toBe('');
    expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveTextContent('Any plan');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Any status');
  });

  it('goes back to the first page when a filter changes', async () => {
    const suspended = seeded.all.filter((m) => m.status === 'suspended');
    const { user, lastUrl } = renderWithProviders(<MembersList />, { searchParams: '?page=2' });
    await screen.findByText(rangeText(total, 20, 2));

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Suspended' }));

    expect(await screen.findByText(rangeText(suspended.length))).toBeInTheDocument();
    expect(lastUrl()).toBe('?status=suspended');
  });

  it('starts from the filters in the URL', async () => {
    const { first } = seeded;
    renderWithProviders(<MembersList />, {
      searchParams: `?q=${encodeURIComponent(first.email)}&plan=${first.plan}&status=${first.status}`,
    });

    expect(await screen.findByRole('link', { name: named(first) })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue(first.email);
    expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveTextContent(humanize(first.plan));
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent(
      humanize(first.status),
    );
    expect(screen.getByText(rangeText(1))).toBeInTheDocument();
  });

  it('ignores a plan or a status in the URL that the API does not know', async () => {
    const queries = watchRequests();
    renderWithProviders(<MembersList />, { searchParams: '?plan=gold&status=bogus' });

    expect(await screen.findByRole('link', { name: named(seeded.first) })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveTextContent('Any plan');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Any status');
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
    expect(queries[0]?.has('plan')).toBe(false);
    expect(queries[0]?.has('status')).toBe(false);
  });

  it('says so when the filters match nothing', async () => {
    renderWithProviders(<MembersList />, { searchParams: '?q=nowhere' });

    expect(await screen.findByText('No members match the current filters.')).toBeInTheDocument();
  });

  it('says so when there are no members at all', async () => {
    server.use(
      http.get('*/bff/members', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 }),
      ),
    );
    renderWithProviders(<MembersList />);

    expect(await screen.findByText('No members yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows a failed load in the table and loads again on retry', async () => {
    let failing = true;
    server.use(
      http.get('*/bff/members', () =>
        failing ? HttpResponse.json({ message: 'The server failed' }, { status: 500 }) : undefined,
      ),
    );
    const { user } = renderWithProviders(<MembersList />);

    expect(await screen.findByText('The server failed')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('link', { name: named(seeded.first) })).toBeInTheDocument();
  });

  it('creates a member and opens their page', async () => {
    const { user } = renderWithProviders(<MembersList />);
    await screen.findByRole('link', { name: named(seeded.first) });

    await user.click(screen.getByRole('button', { name: 'New member' }));
    const dialog = await screen.findByRole('dialog', { name: 'New member' });
    await user.type(within(dialog).getByRole('textbox', { name: /^First name/ }), 'Dana');
    await user.type(within(dialog).getByRole('textbox', { name: /^Last name/ }), 'Testova');
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Email/ }),
      'dana.testova@example.com',
    );
    await user.type(within(dialog).getByRole('textbox', { name: /^Phone/ }), '+380 44 000 00 00');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledOnce();
    });
    expect(String(router.push.mock.calls[0]?.[0])).toMatch(/^\/members\/mem_/);
    expect(toast.success).toHaveBeenCalledWith('Member added', { description: 'Dana Testova' });
  });

  it('refuses a new member with an email that is taken and shows it under the field', async () => {
    const { user } = renderWithProviders(<MembersList />);
    await screen.findByRole('link', { name: named(seeded.first) });

    await user.click(screen.getByRole('button', { name: 'New member' }));
    const dialog = await screen.findByRole('dialog', { name: 'New member' });
    await user.type(within(dialog).getByRole('textbox', { name: /^First name/ }), 'Dana');
    await user.type(within(dialog).getByRole('textbox', { name: /^Last name/ }), 'Testova');
    await user.type(within(dialog).getByRole('textbox', { name: /^Email/ }), seeded.first.email);
    await user.type(within(dialog).getByRole('textbox', { name: /^Phone/ }), '+380 44 000 00 00');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('This email is already registered')).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('edits a member from their row and the list shows the change', async () => {
    const { first } = seeded;
    const { user } = renderWithProviders(<MembersList />);
    await screen.findByRole('link', { name: named(first) });

    await user.click(screen.getByRole('button', { name: `Edit ${named(first)}` }));
    const dialog = await screen.findByRole('dialog', { name: `Edit ${named(first)}` });
    const firstName = within(dialog).getByRole('textbox', { name: /^First name/ });
    expect(firstName).toHaveValue(first.firstName);
    await user.clear(firstName);
    await user.type(firstName, 'Renamed');
    await user.click(within(dialog).getByRole('combobox', { name: /^Status/ }));
    await user.click(await screen.findByRole('option', { name: 'Cancelled' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    const renamed = { ...first, firstName: 'Renamed' };
    expect(await screen.findByRole('link', { name: named(renamed) })).toBeInTheDocument();
    expect(within(rowFor(renamed)).getByText('Cancelled')).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens an edited member with the saved values at once, before the list is refetched', async () => {
    const { first } = seeded;
    const { user } = renderWithProviders(<MembersList />);
    await screen.findByRole('link', { name: named(first) });
    await user.click(screen.getByRole('button', { name: `Edit ${named(first)}` }));
    const dialog = await screen.findByRole('dialog', { name: `Edit ${named(first)}` });
    const lastName = within(dialog).getByRole('textbox', { name: /^Last name/ });
    await user.clear(lastName);
    await user.type(lastName, 'Renamed');
    // The refetch of the list is held back: only the stored answer can show the new name.
    server.use(http.get('*/bff/members', () => delay('infinite')));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    const renamed = { ...first, lastName: 'Renamed' };
    await screen.findByRole('link', { name: named(renamed) });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: `Edit ${named(renamed)}` }));

    const reopened = await screen.findByRole('dialog', { name: `Edit ${named(renamed)}` });
    expect(within(reopened).getByRole('textbox', { name: /^Last name/ })).toHaveValue('Renamed');
  });

  it('opens "New member" after an edit was dismissed, not the edited one', async () => {
    const { first } = seeded;
    const { user } = renderWithProviders(<MembersList />);
    await screen.findByRole('link', { name: named(first) });
    await user.click(screen.getByRole('button', { name: `Edit ${named(first)}` }));
    await user.click(
      within(await screen.findByRole('dialog', { name: `Edit ${named(first)}` })).getByRole(
        'button',
        { name: 'Cancel' },
      ),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'New member' }));

    const dialog = await screen.findByRole('dialog', { name: 'New member' });
    expect(within(dialog).getByRole('textbox', { name: /^First name/ })).toHaveValue('');
  });

  it('refuses to delete a member with upcoming bookings and says why', async () => {
    const { booked } = seeded;
    const { user } = renderWithProviders(<MembersList />);
    await screen.findByRole('link', { name: named(booked) });

    await user.click(screen.getByRole('button', { name: `Delete ${named(booked)}` }));
    const dialog = await screen.findByRole('alertdialog', { name: `Delete ${named(booked)}?` });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'This member has upcoming bookings; cancel them first',
    );
    // The page behind a modal dialog is hidden from assistive technology, but it is still there.
    expect(screen.getByRole('link', { name: named(booked), hidden: true })).toBeInTheDocument();
  });

  it('deletes a member and drops their row', async () => {
    const { free } = seeded;
    const { user } = renderWithProviders(<MembersList />);
    await screen.findByRole('link', { name: named(free) });

    await user.click(screen.getByRole('button', { name: `Delete ${named(free)}` }));
    const dialog = await screen.findByRole('alertdialog', { name: `Delete ${named(free)}?` });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: named(free) })).not.toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith('Member removed', { description: named(free) });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText(rangeText(total - 1))).toBeInTheDocument();
  });

  it('gives each row its own accessible names for the actions', async () => {
    renderWithProviders(<MembersList />);
    await screen.findByRole('link', { name: named(seeded.first) });

    for (const member of seeded.page) {
      expect(screen.getByRole('button', { name: `Edit ${named(member)}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Delete ${named(member)}` })).toBeInTheDocument();
    }
  });
});
