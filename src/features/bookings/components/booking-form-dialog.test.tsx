import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Booking } from '@/lib/contract/booking';
import { formatTimeRange } from '@/lib/format-date';
import { fillNewBooking, formReady, setTime } from '@/test/booking-form';
import { useFakeDebounce } from '@/test/debounce';
import { installMockApi } from '@/test/mock-api';
import { seededBookings } from '@/test/mock-bookings';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { memberLabel, roomLabel } from '@/features/bookings/constants';
import { BookingFormDialog } from './booking-form-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let api: ReturnType<typeof installMockApi>;
let seeded: ReturnType<typeof seededBookings>;
// The drop-downs search after a pause in typing; the fake clock skips the pause.
let clock: ReturnType<typeof useFakeDebounce>;

beforeEach(() => {
  clock = useFakeDebounce();
  api = installMockApi({ via: 'bff' });
  seeded = seededBookings(api);
});

afterEach(() => {
  vi.clearAllMocks();
});

const setup = (booking?: Booking) => {
  const { user, pause } = clock;
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  const view = renderWithProviders(
    <BookingFormDialog open onOpenChange={onOpenChange} booking={booking} onSaved={onSaved} />,
  );
  return { ...view, user, pause, onOpenChange, onSaved };
};

type User = ReturnType<typeof setup>['user'];

const save = (user: User) => user.click(screen.getByRole('button', { name: 'Save' }));

/** An edit form that has found the room of the booking, so it knows the zone of the times. */
const setupEdit = async (booking: Booking) => {
  const view = setup(booking);
  await formReady();
  await screen.findByText(/local time \(/);
  return view;
};

/** Registers the answer of the next edit, for a test that wants the API to refuse it. */
const refuseNextEdit = (status: number, body: object) => {
  server.use(
    http.patch('*/bff/bookings/:id', () => HttpResponse.json(body, { status }), { once: true }),
  );
};

// The one test that fills the whole form walks through two searched drop-downs and a calendar: it
// is the longest flow of the suite, and the parallel run stretches it. `FILL` is its time budget.
// The other flows start from an existing booking, which fills the form at once.
const FILL = 15_000;

describe('BookingFormDialog: creating', () => {
  it('opens empty with the defaults of a new booking', async () => {
    setup();

    expect(await screen.findByRole('dialog', { name: 'New booking' })).toBeInTheDocument();
    await formReady();
    expect(screen.getByRole('combobox', { name: /^Room/ })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /^Member/ })).toHaveValue('');
    expect(screen.getByRole('button', { name: /^Date/ })).toHaveTextContent('Pick a date');
    expect(screen.getByLabelText(/^From/)).toHaveValue('09:00');
    expect(screen.getByLabelText(/^To/)).toHaveValue('10:00');
    expect(screen.getByRole('spinbutton', { name: /^Attendees/ })).toHaveValue(1);
    expect(screen.getByRole('textbox', { name: /^Notes/ })).toHaveValue('');
  });

  it('waits for the time zones before it shows the form', () => {
    setup();

    expect(screen.getByRole('status', { name: 'Loading the form' })).toBeInTheDocument();
  });

  it('closes without saving on Cancel', async () => {
    const { user, onOpenChange } = setup();
    await formReady();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows what is missing under the fields, focuses the first and sends nothing', async () => {
    const posts: string[] = [];
    server.use(
      http.post('*/bff/bookings', () => {
        posts.push('post');
        return HttpResponse.json({});
      }),
    );
    const { user } = setup();
    await formReady();

    await save(user);

    expect(await screen.findByText('Choose a room')).toBeInTheDocument();
    expect(screen.getByText('Choose a member')).toBeInTheDocument();
    // The button says it too, as its placeholder.
    expect(screen.getAllByText('Pick a date')).toHaveLength(2);
    const room = screen.getByRole('combobox', { name: /^Room/ });
    expect(room).toBeInvalid();
    await waitFor(() => {
      expect(room).toHaveFocus();
    });
    expect(posts).toEqual([]);
  });

  it('puts an end that is not after the start, and a stay over eight hours, under the To time', async () => {
    const { user } = setup();
    await formReady();

    setTime(/^To/, '09:00');
    await save(user);
    expect(await screen.findByText('End must be after start')).toBeInTheDocument();
    expect(screen.getByLabelText(/^To/)).toBeInvalid();

    setTime(/^To/, '18:00');
    await save(user);
    expect(await screen.findByText('A booking cannot be longer than 8 hours')).toBeInTheDocument();
  });

  it(
    'saves a pending booking, reading the times on the clock of the room (Kyiv, summer)',
    async () => {
      const kyiv = api.db.locations.find(
        (l) => l.timezone === 'Europe/Kyiv' && l.status === 'active',
      );
      if (!kyiv) throw new Error('seed lacks an active location in Kyiv');
      const { user, pause, onSaved, onOpenChange } = setup();
      const { room, member, location } = await fillNewBooking(user, api, pause, {
        locationId: kyiv.id,
      });
      expect(
        screen.getByText(
          `${location.name} local time (${location.timezone}), open ${location.opensAt}–${location.closesAt}`,
        ),
      ).toBeVisible();
      expect(screen.getByText(`Seats up to ${room.capacity}`)).toBeVisible();
      setTime(/^From/, '09:30');
      setTime(/^To/, '11:00');
      const attendees = screen.getByRole('spinbutton', { name: /^Attendees/ });
      await user.clear(attendees);
      await user.type(attendees, '3');
      await user.click(screen.getByRole('textbox', { name: /^Notes/ }));
      await user.paste('  Bring the projector ');
      await save(user);

      await waitFor(() => {
        expect(onSaved).toHaveBeenCalledOnce();
      });
      expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
        status: 'pending',
        roomId: room.id,
        memberId: member.id,
        startsAt: '2027-06-15T06:30:00.000Z',
        endsAt: '2027-06-15T08:00:00.000Z',
        attendees: 3,
        notes: 'Bring the projector',
      });
      expect(api.db.bookings.some((b) => b.startsAt === '2027-06-15T06:30:00.000Z')).toBe(true);
      expect(toast.success).toHaveBeenCalledWith('Booking created');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    },
    FILL,
  );
});

describe('BookingFormDialog: what the API says about a save', () => {
  // The booking is saved unchanged or with one change: the API answers for the rest.
  let booking: Booking;

  beforeEach(() => {
    booking = seeded.editableConfirmed;
  });

  it('refuses more guests than the room seats before it asks the API', async () => {
    const patches: string[] = [];
    server.use(
      http.patch('*/bff/bookings/:id', () => {
        patches.push('patch');
        return HttpResponse.json({});
      }),
    );
    const { user } = await setupEdit(booking);
    const seats = api.db.rooms.find((r) => r.id === booking.roomId)?.capacity ?? 0;
    const attendees = screen.getByRole('spinbutton', { name: /^Attendees/ });
    await user.clear(attendees);
    await user.type(attendees, String(seats + 1));

    await save(user);

    expect(await screen.findByText(`This room seats up to ${seats}`)).toBeInTheDocument();
    expect(attendees).toBeInvalid();
    await waitFor(() => {
      expect(attendees).toHaveFocus();
    });
    expect(patches).toEqual([]);
  });

  it('puts the refusal of a time outside opening hours under the From time', async () => {
    const { user, onSaved } = await setupEdit(booking);
    const location = api.db.locations.find((l) => l.id === booking.locationId);
    setTime(/^From/, '05:00');
    setTime(/^To/, '06:00');

    await save(user);

    expect(
      await screen.findByText(
        `Outside opening hours (${location?.opensAt}–${location?.closesAt} local time)`,
      ),
    ).toBeInTheDocument();
    const from = screen.getByLabelText(/^From/);
    expect(from).toBeInvalid();
    await waitFor(() => {
      expect(from).toHaveFocus();
    });
    expect(screen.getByRole('dialog', { name: 'Edit booking' })).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('puts the end and the member messages under their own fields', async () => {
    refuseNextEdit(422, {
      message: 'Validation failed',
      fieldErrors: { endsAt: 'End must be after start', memberId: 'Member is suspended' },
    });
    const { user } = await setupEdit(booking);

    await save(user);

    expect(await screen.findByText('Member is suspended')).toBeInTheDocument();
    expect(screen.getByLabelText(/^To/)).toBeInvalid();
    expect(screen.getByRole('combobox', { name: /^Member/ })).toBeInvalid();
  });

  it('shows the message of the API in an alert when a field is not part of the form', async () => {
    refuseNextEdit(422, { message: 'Validation failed', fieldErrors: { colour: 'Nope' } });
    const { user } = await setupEdit(booking);

    await save(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Validation failed');
    await waitFor(() => {
      expect(alert).toHaveFocus();
    });
  });

  it('keeps the dialog open and explains any other failure in an alert', async () => {
    refuseNextEdit(500, { message: 'The server failed' });
    const { user, onSaved, onOpenChange } = await setupEdit(booking);

    await save(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('The server failed');
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('ignores Escape while the booking is being saved', async () => {
    server.use(
      http.patch('*/bff/bookings/:id', async () => {
        await delay(200);
        return undefined;
      }),
    );
    const { user, onOpenChange, onSaved } = await setupEdit(booking);

    await save(user);
    await user.keyboard('{Escape}');

    expect(onOpenChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
  });

  it('says the zone is unknown when the locations could not be read', async () => {
    server.use(
      http.get('*/bff/locations', () => HttpResponse.json({ message: 'Down' }, { status: 500 })),
    );
    const { user, onSaved } = setup(booking);
    await formReady();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /^Room/ })).not.toHaveValue('');
    });

    await save(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Could not find the time zone of the room's location. Try again.",
    );
    expect(
      screen.getByText('The time zone of the location is unknown, so the times are shown in UTC.'),
    ).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('BookingFormDialog: a room that is already booked', () => {
  let booking: Booking;

  beforeEach(() => {
    booking = seeded.editableConfirmed;
  });

  /** A confirmed booking of the same room that starts at `startsAt` and lasts an hour. */
  const holdTheRoom = (startsAt: string) => {
    api.db.bookings.push({
      id: 'bk_holder',
      roomId: booking.roomId,
      memberId: booking.memberId,
      startsAt,
      endsAt: new Date(Date.parse(startsAt) + 3_600_000).toISOString(),
      attendees: 1,
      status: 'confirmed',
      notes: null,
      totalPrice: 0,
      createdAt: startsAt,
    });
  };

  it('lists the bookings in the way in an alert, keeps the dialog open and does not toast', async () => {
    holdTheRoom(booking.startsAt);
    const { user, onSaved, onOpenChange } = await setupEdit(booking);
    const zone = api.db.locations.find((l) => l.id === booking.locationId)?.timezone ?? '';

    await save(user);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('The room is already booked for this time.')).toBeVisible();
    const range = formatTimeRange(
      booking.startsAt,
      new Date(Date.parse(booking.startsAt) + 3_600_000).toISOString(),
      zone,
    );
    const link = within(alert).getByRole('link');
    expect(link).toHaveAccessibleName(`${range} (opens in a new tab)`);
    expect(link).toHaveAttribute('href', '/bookings/bk_holder');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByRole('dialog', { name: 'Edit booking' })).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(alert).toHaveFocus();
    });
  });

  it('drops the alert on the next try', async () => {
    refuseNextEdit(409, {
      message: 'The room is already booked for this time',
      conflicts: [{ id: 'bk_other', startsAt: booking.startsAt, endsAt: booking.endsAt }],
    });
    const { user, onSaved } = await setupEdit(booking);
    await save(user);
    expect(await within(await screen.findByRole('alert')).findByRole('link')).toHaveAttribute(
      'href',
      '/bookings/bk_other',
    );

    await save(user);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(screen.queryByText('The room is already booked for this time.')).not.toBeInTheDocument();
  });

  it('does not count a booking that only touches this one', async () => {
    holdTheRoom(booking.endsAt);
    const { user, onSaved } = await setupEdit(booking);

    await save(user);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
  });

  it('shows a refusal without conflicts as plain text', async () => {
    refuseNextEdit(409, { message: 'Only pending or confirmed bookings can be edited' });
    const { user } = await setupEdit(booking);

    await save(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Only pending or confirmed bookings can be edited');
    expect(within(alert).queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('BookingFormDialog: editing', () => {
  let booking: Booking;

  beforeEach(() => {
    booking = seeded.editablePending;
  });

  it('shows the booking on the clock of its location', async () => {
    const record = api.db.bookings.find((b) => b.id === booking.id);
    if (record) record.notes = 'Needs a quiet corner';
    const location = api.db.locations.find((l) => l.id === booking.locationId);
    const room = api.db.rooms.find((r) => r.id === booking.roomId);
    const member = api.db.members.find((m) => m.id === booking.memberId);
    if (!room || !member || !location) throw new Error('seed is incomplete');
    setup({ ...booking, notes: 'Needs a quiet corner' });

    expect(await screen.findByRole('dialog', { name: 'Edit booking' })).toBeVisible();
    await formReady();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /^Room/ })).toHaveValue(
        roomLabel({ ...room, locationName: location.name }),
      );
    });
    expect(screen.getByRole('combobox', { name: /^Member/ })).toHaveValue(memberLabel(member));
    const wallClock = (iso: string) =>
      new Intl.DateTimeFormat('en-GB', {
        timeZone: location.timezone,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
      }).format(Date.parse(iso));
    expect(screen.getByLabelText(/^From/)).toHaveValue(wallClock(booking.startsAt));
    expect(screen.getByLabelText(/^To/)).toHaveValue(wallClock(booking.endsAt));
    expect(screen.getByRole('spinbutton', { name: /^Attendees/ })).toHaveValue(booking.attendees);
    expect(screen.getByRole('textbox', { name: /^Notes/ })).toHaveValue('Needs a quiet corner');
    expect(screen.getByRole('button', { name: /^Date/ })).not.toHaveTextContent('Pick a date');
  });

  it('saves the changes, toasts and reports the saved booking', async () => {
    const { user, onSaved, onOpenChange } = await setupEdit(booking);
    const attendees = screen.getByRole('spinbutton', { name: /^Attendees/ });
    await user.clear(attendees);
    await user.type(attendees, '1');

    await save(user);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      id: booking.id,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      attendees: 1,
    });
    expect(api.db.bookings.find((b) => b.id === booking.id)?.attendees).toBe(1);
    expect(toast.success).toHaveBeenCalledWith('Booking updated');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('reads the times of a booking on the clock of its own zone when it saves (Berlin)', async () => {
    const berlin = api.db.locations.find((l) => l.timezone === 'Europe/Berlin');
    const inBerlin = seeded.all.find((b) => {
      const room = api.db.rooms.find((r) => r.id === b.roomId);
      const member = api.db.members.find((m) => m.id === b.memberId);
      return (
        b.locationId === berlin?.id &&
        (b.status === 'pending' || b.status === 'confirmed') &&
        room?.status === 'available' &&
        berlin.status === 'active' &&
        member?.status === 'active'
      );
    });
    if (!inBerlin) throw new Error('seed lacks an editable booking in Berlin');
    const { user, onSaved } = await setupEdit(inBerlin);

    await save(user);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    // Read on the clock of Kyiv or the browser, the same wall time would be another instant.
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      startsAt: inBerlin.startsAt,
      endsAt: inBerlin.endsAt,
    });
  });

  it('refuses to save a booking that ends on another day, and says why', async () => {
    const overnight = {
      ...booking,
      endsAt: new Date(Date.parse(booking.startsAt) + 30 * 3_600_000).toISOString(),
    };
    const patches: string[] = [];
    server.use(
      http.patch('*/bff/bookings/:id', () => {
        patches.push('patch');
        return HttpResponse.json({});
      }),
    );
    const { user, onSaved } = await setupEdit(overnight);
    const message = 'This booking ends on another day than it starts.';
    expect(await screen.findByRole('alert')).toHaveTextContent(message);

    await save(user);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveFocus();
    });
    expect(patches).toEqual([]);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('explains a refusal to edit a booking that is over', async () => {
    const { user, onSaved } = await setupEdit(booking);
    const record = api.db.bookings.find((b) => b.id === booking.id);
    if (record) record.status = 'completed';

    await save(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only pending or confirmed bookings can be edited',
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('starts from the booking again after it is closed and opened', async () => {
    const view = await setupEdit(booking);
    const attendees = screen.getByRole('spinbutton', { name: /^Attendees/ });
    await view.user.clear(attendees);
    await view.user.type(attendees, '2');

    view.rerender(<BookingFormDialog open={false} onOpenChange={vi.fn()} booking={booking} />);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    view.rerender(<BookingFormDialog open onOpenChange={vi.fn()} booking={booking} />);

    expect(await screen.findByRole('spinbutton', { name: /^Attendees/ })).toHaveValue(
      booking.attendees,
    );
  });
});
