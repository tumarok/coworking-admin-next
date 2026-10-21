import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatMoney } from '@/lib/money';
import { humanize } from '@/lib/humanize';
import { fillNewBooking } from '@/test/booking-form';
import { useFakeDebounce } from '@/test/debounce';
import { installMockApi } from '@/test/mock-api';
import { rangeOf, seededBookings } from '@/test/mock-bookings';
import { rangeText } from '@/test/mock-members';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { BookingsList } from './bookings-list';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

let api: ReturnType<typeof installMockApi>;
let seeded: ReturnType<typeof seededBookings>;

beforeEach(() => {
  api = installMockApi({ via: 'bff' });
  seeded = seededBookings(api);
});

afterEach(() => {
  vi.clearAllMocks();
});

const total = (matching: (b: (typeof seeded.all)[number]) => boolean = () => true) =>
  seeded.all.filter(matching).length;

/** The footer text of a result with `count` rows on the first page. */
const footer = (count: number) => rangeText(count);

/** Waits for the first page of the full list. */
const loaded = () => screen.findByText(footer(total()));

/** Records the lists the API was asked for. */
const watchRequests = () => {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get('*/bff/bookings', ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return undefined;
    }),
  );
  return queries;
};

/** The body row `n` (0 is the first booking of the list). */
const bodyRow = (n: number) => screen.getAllByRole('row')[n + 1] as HTMLElement;

const subject = (booking: typeof seeded.first) => `${booking.roomName}, ${rangeOf(api, booking)}`;

describe('BookingsList', () => {
  it('shows the bookings of the mock API, newest start first, with room, member, status and price', async () => {
    renderWithProviders(<BookingsList />);

    expect(screen.getByRole('heading', { level: 1, name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByText('Who uses which room, and when')).toBeInTheDocument();
    await loaded();
    const { first } = seeded;
    const row = bodyRow(0);
    const link = within(row).getByRole('link', { name: rangeOf(api, first) });
    expect(link).toHaveAttribute('href', `/bookings/${first.id}`);
    expect(within(row).getByText(first.roomName)).toBeInTheDocument();
    expect(within(row).getByText(first.locationName)).toBeInTheDocument();
    expect(within(row).getByText(first.memberName)).toBeInTheDocument();
    expect(within(row).getByText(String(first.attendees))).toBeInTheDocument();
    expect(within(row).getByText(humanize(first.status))).toBeInTheDocument();
    expect(within(row).getByText(formatMoney(first.totalPrice))).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(21);
  });

  it('keeps the time blank until it knows the zone it is in', async () => {
    server.use(
      http.get('*/bff/locations', async () => {
        await delay(300);
        return undefined;
      }),
    );
    renderWithProviders(<BookingsList />);

    await loaded();
    expect(within(bodyRow(0)).getByText('…')).toBeInTheDocument();
    expect(
      await within(bodyRow(0)).findByRole('link', { name: rangeOf(api, seeded.first) }),
    ).toBeInTheDocument();
  });

  it('shows "Deleted room" for a booking whose room is gone', async () => {
    api.db.rooms = api.db.rooms.filter((r) => r.id !== seeded.first.roomId);
    renderWithProviders(<BookingsList />);

    await loaded();

    expect(within(bodyRow(0)).getByText('Deleted room')).toBeInTheDocument();
    expect(within(bodyRow(0)).getByText('—')).toBeInTheDocument();
    expect(within(bodyRow(0)).getByText(/ UTC$/)).toBeInTheDocument();
  });

  it('pages through the list through the URL', async () => {
    const { user, lastUrl } = renderWithProviders(<BookingsList />);
    await loaded();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText(rangeText(total(), 20, 2))).toBeInTheDocument();
    expect(lastUrl()).toBe('?page=2');
  });

  it('searches after a pause: one request, the text in the URL', async () => {
    const queries = watchRequests();
    const { user, pause } = useFakeDebounce();
    const { lastUrl } = renderWithProviders(<BookingsList />);
    await loaded();
    expect(queries).toHaveLength(1);
    const word = seeded.first.memberName.split(' ')[1] ?? '';

    await user.type(screen.getByRole('searchbox', { name: 'Search member or room' }), word);
    expect(queries).toHaveLength(1);
    pause();

    const matching = total(
      (b) =>
        b.memberName.toLowerCase().includes(word.toLowerCase()) ||
        b.roomName.toLowerCase().includes(word.toLowerCase()) ||
        b.locationName.toLowerCase().includes(word.toLowerCase()),
    );
    expect(await screen.findByText(footer(matching))).toBeInTheDocument();
    expect(lastUrl()).toBe(`?q=${word}`);
    expect(queries).toHaveLength(2);
    expect(queries[1]?.get('q')).toBe(word);
  });

  it('filters by a period of UTC days, the end day included', async () => {
    const queries = watchRequests();
    const { lastUrl } = renderWithProviders(<BookingsList />);
    await loaded();
    const day = seeded.first.startsAt.slice(0, 10);

    fireEvent.change(screen.getByLabelText('From date'), { target: { value: day } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: day } });

    const onDay = total((b) => b.startsAt.slice(0, 10) === day);
    expect(await screen.findByText(footer(onDay))).toBeInTheDocument();
    expect(lastUrl()).toBe(`?from=${day}&to=${day}`);
    expect(queries.at(-1)?.get('from')).toBe(day);
    expect(queries.at(-1)?.get('to')).toBe(day);
    expect(screen.getByLabelText('To date')).toHaveAttribute('min', day);
    expect(screen.getByLabelText('From date')).toHaveAttribute('max', day);
  });

  it('filters by status', async () => {
    const queries = watchRequests();
    const { user, lastUrl } = renderWithProviders(<BookingsList />);
    await loaded();

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Checked in' }));

    expect(
      await screen.findByText(footer(total((b) => b.status === 'checked_in'))),
    ).toBeInTheDocument();
    expect(lastUrl()).toBe('?status=checked_in');
    expect(queries.at(-1)?.get('status')).toBe('checked_in');
    expect(within(bodyRow(0)).getByText('Checked in')).toBeInTheDocument();
  });

  it('filters by a location chosen from all of them', async () => {
    const queries = watchRequests();
    const { user, lastUrl } = renderWithProviders(<BookingsList />);
    await loaded();
    const location = api.db.locations.find((l) => l.id === 'loc_4');
    if (!location) throw new Error('seed lacks loc_4');

    await user.click(screen.getByRole('combobox', { name: 'Location' }));
    await user.click(
      await screen.findByRole('option', { name: `${location.name} (${location.city})` }),
    );

    const here = total((b) => b.locationId === 'loc_4');
    expect(await screen.findByText(footer(here))).toBeInTheDocument();
    expect(lastUrl()).toBe('?locationId=loc_4');
    expect(queries.at(-1)?.get('locationId')).toBe('loc_4');
  });

  it('filters by a room and by a member found with the search, and clears everything', async () => {
    const { user, pause } = useFakeDebounce();
    const { lastUrl } = renderWithProviders(<BookingsList />);
    await loaded();
    const { first } = seeded;
    const room = api.db.rooms.find((r) => r.id === first.roomId);
    const member = api.db.members.find((m) => m.id === first.memberId);
    if (!room || !member) throw new Error('seed is incomplete');

    const roomBox = screen.getByRole('combobox', { name: 'Room' });
    await user.click(roomBox);
    await user.paste(room.name);
    pause();
    await user.click(
      await screen.findByRole('option', {
        name: `${room.name} · ${first.locationName} (${room.capacity} seats)`,
      }),
    );
    expect(await screen.findByText(footer(total((b) => b.roomId === room.id)))).toBeInTheDocument();
    expect(lastUrl()).toBe(`?roomId=${room.id}`);

    const memberBox = screen.getByRole('combobox', { name: 'Member' });
    await user.click(memberBox);
    await user.paste(member.email);
    pause();
    await user.click(
      await screen.findByRole('option', { name: `${first.memberName} · ${member.email}` }),
    );
    expect(
      await screen.findByText(
        footer(total((b) => b.roomId === room.id && b.memberId === member.id)),
      ),
    ).toBeInTheDocument();
    expect(lastUrl()).toBe(`?roomId=${room.id}&memberId=${member.id}`);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText(footer(total()))).toBeInTheDocument();
    expect(lastUrl()).toBe('');
    expect(roomBox).toHaveValue('');
    expect(memberBox).toHaveValue('');
  });

  it('goes back to the first page when a filter changes', async () => {
    const { user, lastUrl } = renderWithProviders(<BookingsList />, { searchParams: '?page=3' });
    await screen.findByText(rangeText(total(), 20, 3));

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Cancelled' }));

    expect(
      await screen.findByText(footer(total((b) => b.status === 'cancelled'))),
    ).toBeInTheDocument();
    expect(lastUrl()).toBe('?status=cancelled');
  });

  it('starts from the filters in the URL and names the chosen room and member', async () => {
    const { first } = seeded;
    renderWithProviders(<BookingsList />, {
      searchParams: `?roomId=${first.roomId}&memberId=${first.memberId}&status=${first.status}`,
    });

    expect(await screen.findByRole('combobox', { name: 'Status' })).toHaveTextContent(
      humanize(first.status),
    );
    await waitFor(() => {
      expect(screen.getByRole<HTMLInputElement>('combobox', { name: 'Room' }).value).toContain(
        first.roomName,
      );
    });
    await waitFor(() => {
      expect(screen.getByRole<HTMLInputElement>('combobox', { name: 'Member' }).value).toContain(
        first.memberName,
      );
    });
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('ignores a date and a status in the URL that the API would refuse', async () => {
    const queries = watchRequests();
    renderWithProviders(<BookingsList />, {
      searchParams: '?from=yesterday&to=2026-13-45&status=bogus',
    });

    await loaded();

    expect(queries).toHaveLength(1);
    expect(queries[0]?.has('from')).toBe(false);
    expect(queries[0]?.has('to')).toBe(false);
    expect(queries[0]?.has('status')).toBe(false);
    expect(screen.getByLabelText('From date')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('says so when the filters match nothing', async () => {
    renderWithProviders(<BookingsList />, { searchParams: '?q=nowhere-at-all' });

    expect(await screen.findByText('No bookings match the current filters.')).toBeInTheDocument();
  });

  it('says so when there are no bookings at all', async () => {
    server.use(
      http.get('*/bff/bookings', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 }),
      ),
    );
    renderWithProviders(<BookingsList />);

    expect(await screen.findByText('No bookings yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows a failed load in the table and loads again on retry', async () => {
    let failing = true;
    server.use(
      http.get('*/bff/bookings', () =>
        failing ? HttpResponse.json({ message: 'The server failed' }, { status: 500 }) : undefined,
      ),
    );
    const { user } = renderWithProviders(<BookingsList />);

    expect(await screen.findByText('The server failed')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await loaded();
  });
});

describe('BookingsList: creating and editing', () => {
  // The whole form is filled in (two searched drop-downs and a calendar): the longest flow here.
  it('creates a booking and opens its page', async () => {
    const { user, pause } = useFakeDebounce();
    renderWithProviders(<BookingsList />);
    await loaded();

    await user.click(screen.getByRole('button', { name: 'New booking' }));
    await screen.findByRole('dialog', { name: 'New booking' });
    await fillNewBooking(user, api, pause);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledOnce();
    });
    expect(String(router.push.mock.calls[0]?.[0])).toMatch(/^\/bookings\/bk_/);
    expect(toast.success).toHaveBeenCalledWith('Booking created');
  }, 15_000);

  it('edits a pending booking from its row and the list shows the change at once', async () => {
    const { pending } = seeded;
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();

    await user.click(screen.getByRole('button', { name: `Edit booking: ${subject(pending)}` }));
    await screen.findByRole('dialog', { name: 'Edit booking' });
    const attendees = await screen.findByRole('spinbutton', { name: /^Attendees/ });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /^Room/ })).not.toHaveValue('');
    });
    await user.clear(attendees);
    await user.type(attendees, '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Booking updated');
    });
    expect(api.db.bookings.find((b) => b.id === pending.id)?.attendees).toBe(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens "New booking" after an edit was dismissed, not the edited one', async () => {
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(
      screen.getByRole('button', { name: `Edit booking: ${subject(seeded.pending)}` }),
    );
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Edit booking' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'New booking' }));

    expect(await screen.findByRole('dialog', { name: 'New booking' })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: /^Room/ })).toHaveValue('');
  });

  it('offers no editing and no status change on bookings that are over', async () => {
    renderWithProviders(<BookingsList />, { searchParams: '?status=completed' });

    await screen.findByText(footer(total((b) => b.status === 'completed')));

    expect(screen.queryByRole('button', { name: /^Edit booking/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^(Confirm|Cancel booking|Check in)/ }),
    ).not.toBeInTheDocument();
  });

  it('moves a booking on from its row, and says so', async () => {
    const { pending } = seeded;
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();

    await user.click(screen.getByRole('button', { name: `Confirm: ${subject(pending)}` }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Booking confirmed');
    });
    expect(api.db.bookings.find((b) => b.id === pending.id)?.status).toBe('confirmed');
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: `Confirm: ${subject(pending)}` }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: `Check in: ${subject(pending)}` })).toBeVisible();
  });
});
