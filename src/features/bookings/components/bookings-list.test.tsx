import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatMoney } from '@/lib/money';
import { DEFAULT_PAGE_SIZE } from '@/lib/contract/common';
import { humanize } from '@/lib/humanize';
import { fillNewBooking } from '@/test/booking-form';
import { useFakeDebounce } from '@/test/debounce';
import { installMockApi } from '@/test/mock-api';
import { rangeOf, seededBookings } from '@/test/mock-bookings';
import { rangeText } from '@/test/mock-members';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { bookingKeys } from '@/features/bookings/api/booking-keys';
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

describe('BookingsList: bulk actions', () => {
  /** The checkbox of a booking's row, named by room and time like its other buttons. */
  const pick = (booking: typeof seeded.first) =>
    screen.findByRole('checkbox', { name: `Select ${subject(booking)}` });

  const bar = () => screen.queryByRole('toolbar', { name: 'Bulk actions' });
  const status = () => screen.getByRole('status');
  const confirmSelected = () => screen.getByRole('button', { name: 'Confirm selected bookings' });
  const cancelSelected = () => screen.getByRole('button', { name: 'Cancel selected bookings' });
  const heading = () => screen.getByRole('heading', { name: 'Bookings' });

  /** Holds the answer of the bulk request until the test lets it go. */
  const holdBulk = () => {
    const gate = Promise.withResolvers<undefined>();
    server.use(
      http.post('*/bff/bookings/bulk', async () => {
        await gate.promise;
        return undefined;
      }),
    );
    return gate;
  };

  it('shows the bar only while something is selected', async () => {
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    expect(bar()).not.toBeInTheDocument();
    expect(status()).toBeEmptyDOMElement();

    await user.click(await pick(seeded.pending));

    expect(bar()).toBeInTheDocument();
    expect(status()).toHaveTextContent('1 selected');
    await user.click(await pick(seeded.pending));
    expect(bar()).not.toBeInTheDocument();
    expect(status()).toBeEmptyDOMElement();
  });

  it('selects the whole page from the header and clears it from the bar', async () => {
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();

    await user.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));

    expect(status()).toHaveTextContent(`${seeded.page.length} selected`);
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(bar()).not.toBeInTheDocument();
    // The button that was pressed is gone, so the title takes the focus.
    expect(heading()).toHaveFocus();
  });

  it('keeps the selection when the page changes', async () => {
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(seeded.first));

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText(rangeText(total(), DEFAULT_PAGE_SIZE, 2));
    // Any row of the second page: its name is not needed, only that it is not on the first.
    const [onSecondPage] = await screen.findAllByRole('checkbox', { name: /^Select (?!all rows)/ });
    await user.click(onSecondPage as HTMLElement);

    expect(status()).toHaveTextContent('2 selected');
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    await screen.findByText(footer(total()));
    expect(await pick(seeded.first)).toBeChecked();
    expect(await pick(seeded.pending)).not.toBeChecked();
  });

  it('starts the selection again when a filter changes', async () => {
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(seeded.pending));
    expect(status()).toHaveTextContent('1 selected');

    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2020-01-01' } });

    await waitFor(() => {
      expect(bar()).not.toBeInTheDocument();
    });
    expect(status()).toBeEmptyDOMElement();
  });

  it('starts the selection again when the search changes', async () => {
    const { user, pause } = useFakeDebounce();
    renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(seeded.pending));

    await user.type(screen.getByRole('searchbox', { name: 'Search member or room' }), 'a');
    pause();

    await waitFor(() => {
      expect(bar()).not.toBeInTheDocument();
    });
  });

  it('confirms the selected bookings, says so and clears the selection', async () => {
    const { pending } = seeded;
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(pending));

    await user.click(confirmSelected());

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('1 booking confirmed');
    });
    expect(api.db.bookings.find((b) => b.id === pending.id)?.status).toBe('confirmed');
    expect(bar()).not.toBeInTheDocument();
    expect(await pick(pending)).not.toBeChecked();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The buttons that had focus are gone, so the title has it.
    expect(heading()).toHaveFocus();
    // The list shows the change: the row now offers the next move.
    expect(
      await screen.findByRole('button', { name: `Check in: ${subject(pending)}` }),
    ).toBeVisible();
  });

  it('names the bookings it could not change and keeps only those selected', async () => {
    const { pending, confirmed } = seeded;
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(pending));
    await user.click(await pick(confirmed));

    await user.click(confirmSelected());

    const dialog = await screen.findByRole('dialog', {
      name: 'Some bookings were not confirmed',
    });
    expect(toast.success).toHaveBeenCalledWith('1 booking confirmed');
    const link = within(dialog).getByRole('link', { name: new RegExp(subject(confirmed)) });
    expect(link).toHaveAttribute('href', `/bookings/${confirmed.id}`);
    expect(within(dialog).getByText('Cannot confirm a booking that is confirmed')).toBeVisible();
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1);
    expect(
      within(dialog).getByText('They are still selected, so you can look at them or try again.'),
    ).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // Behind the dialog the page is hidden from the tree, so the selection is read after it.
    expect(status()).toHaveTextContent('1 selected');
    expect(await pick(confirmed)).toBeChecked();
    expect(await pick(pending)).not.toBeChecked();
    // The selection is still there, and the focus is back on the page rather than lost.
    expect(heading()).toHaveFocus();
  });

  it('shows what a refusal means for a row that was out of date', async () => {
    const { pending } = seeded;
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(pending));
    // Somebody else confirmed it after this list was loaded.
    const record = api.db.bookings.find((b) => b.id === pending.id);
    if (!record) throw new Error('the seeded booking is gone');
    record.status = 'confirmed';

    await user.click(confirmSelected());

    const dialog = await screen.findByRole('dialog', { name: 'Some bookings were not confirmed' });
    expect(within(dialog).getByText('Cannot confirm a booking that is confirmed')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    // The lists were fetched again: the row now says what it really is.
    expect(
      await screen.findByRole('button', { name: `Check in: ${subject(pending)}` }),
    ).toBeVisible();
  });

  it('takes a booking that no longer exists off the selection and says so', async () => {
    const { pending } = seeded;
    server.use(
      http.post('*/bff/bookings/bulk', () =>
        HttpResponse.json({
          updated: [],
          failed: [{ id: pending.id, reason: 'Booking not found' }],
        }),
      ),
    );
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(pending));

    await user.click(confirmSelected());

    const dialog = await screen.findByRole('dialog', { name: /not confirmed/ });
    expect(within(dialog).getByText('Booking not found')).toBeVisible();
    expect(
      within(dialog).getByText('They no longer exist, so they were taken off the selection.'),
    ).toBeVisible();
    expect(toast.success).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(bar()).not.toBeInTheDocument();
    expect(heading()).toHaveFocus();
  });

  it('names a refused booking by its id when the list does not know it', async () => {
    server.use(
      http.post('*/bff/bookings/bulk', () =>
        HttpResponse.json({
          updated: [],
          failed: [{ id: 'bk_unlisted', reason: 'Cannot confirm a booking that is completed' }],
        }),
      ),
    );
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(seeded.pending));

    await user.click(confirmSelected());

    const dialog = await screen.findByRole('dialog', { name: /not confirmed/ });
    expect(within(dialog).getByRole('link', { name: /^bk_unlisted/ })).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    // Nothing was changed and the real booking was not mentioned, so it stays selected.
    expect(await screen.findByText('1 selected')).toBeInTheDocument();
  });

  it('shows the freshest copy of a selected row when it names a refusal', async () => {
    const { pending, confirmed } = seeded;
    const { user, queryClient } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(confirmed));
    const pendingBox = await pick(pending);
    // The room of the first booking is renamed after the row was selected, and the list reloads.
    const room = api.db.rooms.find((r) => r.id === confirmed.roomId);
    if (!room) throw new Error('the seeded booking has no room');
    room.name = 'Renamed Room';
    await queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    await screen.findAllByText('Renamed Room');

    // Selecting another row rebuilds the selection from the rows on screen.
    await user.click(pendingBox);
    await user.click(confirmSelected());

    const dialog = await screen.findByRole('dialog', { name: /not confirmed/ });
    expect(within(dialog).getByRole('link', { name: /^Renamed Room, / })).toBeVisible();
  });

  it('asks before cancelling, and cancels the selected bookings once confirmed', async () => {
    const { pending, confirmed } = seeded;
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(pending));
    await user.click(await pick(confirmed));

    await user.click(cancelSelected());
    const ask = await screen.findByRole('alertdialog', { name: 'Cancel 2 bookings?' });
    expect(api.db.bookings.find((b) => b.id === pending.id)?.status).toBe('pending');
    await user.click(within(ask).getByRole('button', { name: 'Cancel bookings' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('2 bookings cancelled');
    });
    expect(api.db.bookings.find((b) => b.id === pending.id)?.status).toBe('cancelled');
    expect(api.db.bookings.find((b) => b.id === confirmed.id)?.status).toBe('cancelled');
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(bar()).not.toBeInTheDocument();
    // The Cancel button is gone with the bar; focus lands on the title once the question closed.
    await waitFor(() => {
      expect(heading()).toHaveFocus();
    });
  });

  it('keeps the title of the question while it closes', async () => {
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(seeded.pending));
    await user.click(cancelSelected());
    const ask = await screen.findByRole('alertdialog', { name: 'Cancel 1 booking?' });

    await user.click(within(ask).getByRole('button', { name: 'Cancel bookings' }));

    // The selection is empty by now, yet the question still reads "1 booking" until it is gone.
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('1 booking cancelled');
    });
    expect(
      screen.queryByRole('alertdialog', { name: 'Cancel 0 bookings?' }),
    ).not.toBeInTheDocument();
  });

  it('cancels nothing when the question is dismissed, and keeps the selection', async () => {
    const { pending } = seeded;
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(pending));

    await user.click(cancelSelected());
    const ask = await screen.findByRole('alertdialog', { name: 'Cancel 1 booking?' });
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(api.db.bookings.find((b) => b.id === pending.id)?.status).toBe('pending');
    expect(status()).toHaveTextContent('1 selected');
    // The button that asked is still there, so focus goes back to it.
    await waitFor(() => {
      expect(cancelSelected()).toHaveFocus();
    });
  });

  it('asks a fresh question each time', async () => {
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(seeded.pending));
    await user.click(cancelSelected());
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    await user.click(await pick(seeded.confirmed));

    await user.click(cancelSelected());

    expect(await screen.findByRole('alertdialog', { name: 'Cancel 2 bookings?' })).toBeVisible();
  });

  it('says so when the request fails, and keeps the selection to try again', async () => {
    server.use(
      http.post('*/bff/bookings/bulk', () =>
        HttpResponse.json({ message: 'The server failed' }, { status: 500 }),
      ),
    );
    const { user } = renderWithProviders(<BookingsList />);
    await loaded();
    await user.click(await pick(seeded.pending));

    await user.click(cancelSelected());
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Cancel bookings',
      }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('The server failed');
    });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(status()).toHaveTextContent('1 selected');
    expect(confirmSelected()).toBeEnabled();
  });

  it('goes to the login page when the session has ended', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/bookings', search: '', assign });
    try {
      server.use(
        http.post('*/bff/bookings/bulk', () =>
          HttpResponse.json({ message: 'Authentication required' }, { status: 401 }),
        ),
      );
      const { user } = renderWithProviders(<BookingsList />);
      await loaded();
      await user.click(await pick(seeded.pending));

      await user.click(confirmSelected());

      await waitFor(() => {
        expect(assign).toHaveBeenCalledWith('/login?from=%2Fbookings');
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  describe('while the request runs', () => {
    it('locks the bar and the checkboxes', async () => {
      const gate = holdBulk();
      try {
        const { user } = renderWithProviders(<BookingsList />);
        await loaded();
        await user.click(await pick(seeded.pending));
        const other = await pick(seeded.first);

        await user.click(confirmSelected());

        await waitFor(() => {
          expect(confirmSelected()).toBeDisabled();
        });
        expect(cancelSelected()).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Clear selection' })).toBeDisabled();
        expect(other).toHaveAttribute('aria-disabled', 'true');
        expect(
          screen.getByRole('checkbox', { name: 'Select all rows on this page' }),
        ).toHaveAttribute('aria-disabled', 'true');
        await user.click(other);
        expect(status()).toHaveTextContent('1 selected');
      } finally {
        gate.resolve(undefined);
      }
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('1 booking confirmed');
      });
    });

    it('lets a changed filter start the selection again; the answer then changes nothing in it', async () => {
      const gate = holdBulk();
      try {
        const { user } = renderWithProviders(<BookingsList />);
        await loaded();
        await user.click(await pick(seeded.pending));
        await user.click(confirmSelected());
        await waitFor(() => {
          expect(confirmSelected()).toBeDisabled();
        });

        fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2020-01-01' } });
        await waitFor(() => {
          expect(bar()).not.toBeInTheDocument();
        });
      } finally {
        gate.resolve(undefined);
      }

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('1 booking confirmed');
      });
      expect(bar()).not.toBeInTheDocument();
    });
  });
});
