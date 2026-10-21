import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { durationHours, formatDateTime } from '@/lib/format-date';
import { formatMoney } from '@/lib/money';
import { humanize } from '@/lib/humanize';
import { installMockApi } from '@/test/mock-api';
import { rangeOf, seededBookings, zoneOf } from '@/test/mock-bookings';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { BookingDetails } from './booking-details';

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

const fields = () => {
  const terms = screen.getAllByRole('term').map((term) => term.textContent);
  const values = screen.getAllByRole('definition').map((value) => value.textContent);
  return Object.fromEntries(terms.map((term, index) => [term, values[index]]));
};

const title = (booking: typeof seeded.first) => `${booking.roomName}, ${rangeOf(api, booking)}`;

describe('BookingDetails', () => {
  it('shows a placeholder while the booking loads', () => {
    renderWithProviders(<BookingDetails id={seeded.pending.id} />);

    expect(screen.getByRole('status', { name: 'Loading booking' })).toBeInTheDocument();
  });

  it('shows every field, with the times on the clock of the location', async () => {
    const booking = seeded.confirmed;
    const zone = zoneOf(api, booking);
    renderWithProviders(<BookingDetails id={booking.id} />);

    expect(await screen.findByRole('heading', { level: 1, name: title(booking) })).toBeVisible();
    expect(fields()).toEqual({
      Status: humanize(booking.status),
      Room: booking.roomName,
      Location: booking.locationName,
      Member: booking.memberName,
      Starts: formatDateTime(booking.startsAt, zone),
      Ends: formatDateTime(booking.endsAt, zone),
      Duration: `${durationHours(booking.startsAt, booking.endsAt)} h`,
      Attendees: String(booking.attendees),
      Price: formatMoney(booking.totalPrice),
      Created: formatDateTime(booking.createdAt, zone),
      Notes: '—',
    });
    expect(screen.getByRole('link', { name: booking.memberName })).toHaveAttribute(
      'href',
      `/members/${booking.memberId}`,
    );
    expect(screen.getByRole('link', { name: booking.locationName })).toHaveAttribute(
      'href',
      `/locations/${booking.locationId}`,
    );
    expect(screen.getByRole('link', { name: 'Bookings' })).toHaveAttribute('href', '/bookings');
  });

  it('shows the notes of a booking that has them', async () => {
    const booking = seeded.pending;
    const record = api.db.bookings.find((b) => b.id === booking.id);
    if (record) record.notes = 'Needs a quiet corner';
    renderWithProviders(<BookingDetails id={booking.id} />);

    await screen.findByRole('heading', { level: 1 });
    expect(fields()).toMatchObject({ Notes: 'Needs a quiet corner' });
  });

  it('says so when the room, the location and the member have been deleted', async () => {
    const booking = seeded.pending;
    api.db.rooms = api.db.rooms.filter((r) => r.id !== booking.roomId);
    api.db.members = api.db.members.filter((m) => m.id !== booking.memberId);
    renderWithProviders(<BookingDetails id={booking.id} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: /^Deleted room, .* UTC$/ }),
    ).toBeVisible();
    expect(fields()).toMatchObject({
      Room: 'Deleted room',
      Location: 'Deleted location',
      Member: 'Deleted member',
    });
    expect(screen.queryByRole('link', { name: 'Deleted member' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Deleted location' })).not.toBeInTheDocument();
    expect(fields().Starts).toMatch(/ UTC$/);
  });

  it('prints the times in UTC, and says so, when the locations cannot be read', async () => {
    server.use(
      http.get('*/bff/locations', () => HttpResponse.json({ message: 'Down' }, { status: 500 })),
    );
    renderWithProviders(<BookingDetails id={seeded.confirmed.id} />);

    await screen.findByRole('heading', { level: 1 });
    expect(fields().Starts).toMatch(/ UTC$/);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('explains an unknown booking on the page, with a way back and no toast', async () => {
    renderWithProviders(<BookingDetails id="bk_missing" />);

    expect(await screen.findByRole('heading', { name: 'Booking not found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'All bookings' })).toHaveAttribute('href', '/bookings');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('explains any other failure and tries again on request', async () => {
    let fail = true;
    server.use(
      http.get('*/bff/bookings/:id', () =>
        fail ? HttpResponse.json({ message: 'The server failed' }, { status: 500 }) : undefined,
      ),
    );
    const { user } = renderWithProviders(<BookingDetails id={seeded.pending.id} />);

    expect(
      await screen.findByRole('heading', { name: 'Could not load the booking' }),
    ).toBeVisible();
    expect(screen.getByText('The server failed')).toBeVisible();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: title(seeded.pending) }),
    ).toBeVisible();
  });
});

describe('BookingDetails: status changes', () => {
  const buttons = () =>
    screen
      .queryAllByRole('button')
      .map((b) => b.textContent)
      .filter((text) => text !== '' && text !== 'Skip to content');

  it('offers confirm, cancel and edit on a pending booking', async () => {
    renderWithProviders(<BookingDetails id={seeded.pending.id} />);

    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Check in' })).not.toBeInTheDocument();
    expect(buttons()).not.toContain('No-show');
  });

  it('offers check in, no-show, cancel and edit on a confirmed booking', async () => {
    renderWithProviders(<BookingDetails id={seeded.confirmed.id} />);

    await screen.findByRole('heading', { level: 1 });

    for (const name of ['Check in', 'No-show', 'Cancel booking', 'Edit']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });

  it('offers only completing on a checked-in booking, and no editing', async () => {
    renderWithProviders(<BookingDetails id={seeded.checkedIn.id} />);

    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByRole('button', { name: 'Complete' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it.each(['completed', 'cancelled'] as const)('offers nothing on a %s booking', async (status) => {
    renderWithProviders(<BookingDetails id={seeded[status].id} />);

    await screen.findByRole('heading', { level: 1 });

    expect(
      screen.queryByRole('button', { name: /Confirm|Check in|Complete|No-show|Cancel|Edit/ }),
    ).not.toBeInTheDocument();
  });

  it('confirms a booking, says so and shows the new status', async () => {
    const booking = seeded.pending;
    const { user } = renderWithProviders(<BookingDetails id={booking.id} />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(fields().Status).toBe('Confirmed');
    });
    expect(toast.success).toHaveBeenCalledWith('Booking confirmed');
    expect(api.db.bookings.find((b) => b.id === booking.id)?.status).toBe('confirmed');
    expect(await screen.findByRole('button', { name: 'Check in' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });

  it.each([
    ['Check in', 'Booking checked in', 'Checked in'],
    ['No-show', 'Booking no show', 'No show'],
  ])('%s: toasts "%s" and shows %s', async (button, message, status) => {
    const { user } = renderWithProviders(<BookingDetails id={seeded.confirmed.id} />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: button }));

    await waitFor(() => {
      expect(fields().Status).toBe(status);
    });
    expect(toast.success).toHaveBeenCalledWith(message);
  });

  it('asks before cancelling, and cancels on confirmation', async () => {
    const booking = seeded.pending;
    const { user } = renderWithProviders(<BookingDetails id={booking.id} />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Cancel this booking?' });
    expect(api.db.bookings.find((b) => b.id === booking.id)?.status).toBe('pending');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));

    await waitFor(() => {
      expect(fields().Status).toBe('Cancelled');
    });
    expect(toast.success).toHaveBeenCalledWith('Booking cancelled');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument();
  });

  it('moves focus to the heading when the buttons disappear after cancelling', async () => {
    const { user } = renderWithProviders(<BookingDetails id={seeded.pending.id} />);
    const heading = await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));

    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('keeps the booking when the cancel question is dismissed', async () => {
    const { user } = renderWithProviders(<BookingDetails id={seeded.pending.id} />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(fields().Status).toBe('Pending');
  });

  it('explains a refused cancel inside the dialog, which stays open', async () => {
    server.use(
      http.post('*/bff/bookings/:id/status', () =>
        HttpResponse.json(
          { message: 'Cannot change status from completed to cancelled' },
          { status: 409 },
        ),
      ),
    );
    const { user } = renderWithProviders(<BookingDetails id={seeded.pending.id} />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Cannot change status from completed to cancelled',
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('toasts the message of the API when another change is refused', async () => {
    server.use(
      http.post('*/bff/bookings/:id/status', () =>
        HttpResponse.json(
          { message: 'Cannot change status from confirmed to confirmed' },
          { status: 409 },
        ),
      ),
    );
    const { user } = renderWithProviders(<BookingDetails id={seeded.pending.id} />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Cannot change status from confirmed to confirmed');
    });
    expect(fields().Status).toBe('Pending');
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  });

  it('disables the other buttons while a change is on its way', async () => {
    server.use(
      http.post('*/bff/bookings/:id/status', async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return undefined;
      }),
    );
    const { user } = renderWithProviders(<BookingDetails id={seeded.pending.id} />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await waitFor(() => {
      expect(fields().Status).toBe('Confirmed');
    });
  });
});

describe('BookingDetails: editing', () => {
  it('opens the edit form with the booking in it', async () => {
    const { user } = renderWithProviders(<BookingDetails id={seeded.pending.id} />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByRole('dialog', { name: 'Edit booking' })).toBeVisible();
  });
});
