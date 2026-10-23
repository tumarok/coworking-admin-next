import { expect, test } from './fixtures';
import { BookingDetailsPage } from './pages/booking-details-page';
import { BookingFormDialog } from './pages/booking-form-dialog';
import { BookingsPage } from './pages/bookings-page';
import { Notifications } from './pages/notifications';
import type { ApiClient } from './support/api-client';
import {
  createBookable,
  createBooking,
  firstOf,
  type BookingRecord,
  type LocationRecord,
  type MemberRecord,
  type RoomRecord,
  type PageOf,
} from './support/data';
import { clockIn, daysFromToday, printedDay, printedRange, zonedDay } from './support/dates';
import { query, withQuery, withoutQuery } from './support/url';

type BookingView = BookingRecord & {
  roomId: string;
  memberId: string;
  locationId: string;
  totalPrice: number;
};

/** The booking at the top of the list, and the zone its times are read on. */
async function topBooking(api: ApiClient) {
  const booking = await firstOf<BookingView>(api, '/bookings');
  const location = await api.get<LocationRecord>(`/locations/${booking.locationId}`);
  return { booking, timeZone: location.timezone };
}

const totalOf = async (api: ApiClient, params: Record<string, string>) =>
  (await api.get<PageOf<BookingRecord>>('/bookings', { ...params, limit: 1 })).total;

test.describe('list', () => {
  test('lists the bookings of the API with the pager saying how many', async ({ page, api }) => {
    const total = await totalOf(api, {});
    const bookings = new BookingsPage(page);
    await bookings.goto();

    expect(await bookings.table.total()).toBe(total);
    await expect(bookings.table.rows).toHaveCount(20);
  });

  test('prints each booking on the clock of its location', async ({ page, api }) => {
    const { booking, timeZone } = await topBooking(api);
    const bookings = new BookingsPage(page);
    await bookings.goto();

    // Two rooms may be booked at the same hour: the link is the one in the row of this room.
    await expect(
      bookings.table
        .row(booking.roomName)
        .getByRole('link', { name: printedRange(booking.startsAt, booking.endsAt, timeZone) }),
    ).toBeVisible();
  });

  test('filters by status', async ({ page, api }) => {
    const total = await totalOf(api, { status: 'pending' });
    const bookings = new BookingsPage(page);
    await bookings.goto();

    await bookings.toolbar.choose('Status', 'Pending');
    await expect(page).toHaveURL(withQuery({ status: 'pending' }));
    await expect.poll(() => bookings.table.total()).toBe(total);
    await expect(bookings.table.rows.filter({ hasNotText: 'Pending' })).toHaveCount(0);
  });

  test('filters by a range of days', async ({ page, api }) => {
    const { booking } = await topBooking(api);
    const day = booking.startsAt.slice(0, 10);
    const total = await totalOf(api, { from: day, to: day });
    const bookings = new BookingsPage(page);
    await bookings.goto();

    await bookings.fromDate.fill(day);
    await bookings.toDate.fill(day);
    await expect(page).toHaveURL(withQuery({ from: day, to: day }));
    await expect.poll(() => bookings.table.total()).toBe(total);
    expect(total).toBeGreaterThan(0);
  });

  test('filters by the room, the member and the location', async ({ page, api }) => {
    const { booking } = await topBooking(api);
    const room = await api.get<RoomRecord>(`/rooms/${booking.roomId}`);
    const member = await api.get<MemberRecord>(`/members/${booking.memberId}`);
    const location = await api.get<LocationRecord>(`/locations/${booking.locationId}`);
    const bookings = new BookingsPage(page);
    await bookings.goto();

    await bookings.toolbar.choose('Location', `${location.name} (${location.city})`);
    const roomFilter = page.getByRole('combobox', { name: 'Room', exact: true });
    await roomFilter.click();
    await roomFilter.fill(room.name);
    await page
      .getByRole('option', { name: `${room.name} · ${room.locationName} (${room.capacity} seats)` })
      .click();
    const memberFilter = page.getByRole('combobox', { name: 'Member', exact: true });
    await memberFilter.click();
    await memberFilter.fill(member.email);
    await page
      .getByRole('option', { name: `${member.firstName} ${member.lastName} · ${member.email}` })
      .click();

    const filters = { locationId: location.id, roomId: room.id, memberId: member.id };
    await expect(page).toHaveURL(withQuery(filters));
    const total = await totalOf(api, filters);
    await expect.poll(() => bookings.table.total()).toBe(total);
    await expect(bookings.table.row(booking.memberName).first()).toBeVisible();

    await bookings.toolbar.clearFilters.click();
    await expect(page).toHaveURL(withoutQuery);
  });

  test('finds bookings by the name of the member', async ({ page, api }) => {
    const { booking } = await topBooking(api);
    const total = await totalOf(api, { q: booking.memberName });
    const bookings = new BookingsPage(page);
    await bookings.goto();

    await bookings.toolbar.search.fill(booking.memberName);
    await expect(page).toHaveURL(withQuery({ q: booking.memberName }));
    await expect.poll(() => bookings.table.total()).toBe(total);
  });

  test('says so when nothing matches', async ({ page }) => {
    const bookings = new BookingsPage(page);
    await bookings.goto(query({ q: 'nobody has booked this' }));
    await bookings.table.expectEmpty('No bookings match the current filters.');
  });

  test('pages through the list', async ({ page }) => {
    const bookings = new BookingsPage(page);
    await bookings.goto();

    await bookings.table.nextPage.click();
    await expect(page).toHaveURL(withQuery({ page: '2' }));
    await expect(bookings.table.range).toHaveText(/^21–40 of \d+$/);
  });
});

test.describe('selection', () => {
  test('counts the ticked rows, across pages, and lets them go', async ({ page }) => {
    const bookings = new BookingsPage(page);
    await bookings.goto();
    await expect(bookings.selectedCount).toHaveCount(0);

    await bookings.table.rows.nth(0).getByRole('checkbox').check();
    await bookings.table.rows.nth(1).getByRole('checkbox').check();
    await expect(bookings.selectedCount).toHaveText('2 selected');
    await expect(bookings.bulkConfirm).toBeEnabled();
    await expect(bookings.bulkCancel).toBeEnabled();

    await bookings.table.nextPage.click();
    await bookings.table.expectLoaded();
    await expect(bookings.selectedCount).toHaveText('2 selected');

    await bookings.clearSelection.click();
    await expect(bookings.selectedCount).toHaveCount(0);
    await expect(bookings.bulkConfirm).toHaveCount(0);
  });

  test('ticks every row of the page at once', async ({ page }) => {
    const bookings = new BookingsPage(page);
    await bookings.goto();

    await bookings.table.selectAll.check();
    await expect(bookings.selectedCount).toHaveText('20 selected');
    await bookings.table.selectAll.uncheck();
    await expect(bookings.selectedCount).toHaveCount(0);
  });

  test('starts again when a filter changes', async ({ page }) => {
    const bookings = new BookingsPage(page);
    await bookings.goto();
    await bookings.table.rows.nth(0).getByRole('checkbox').check();
    await expect(bookings.selectedCount).toHaveText('1 selected');

    await bookings.toolbar.choose('Status', 'Pending');
    await expect(page).toHaveURL(withQuery({ status: 'pending' }));
    await expect(bookings.selectedCount).toHaveCount(0);
  });
});

test.describe('details', () => {
  test('shows a booking with its times on the clock of the location', async ({ page, api }) => {
    const { booking, timeZone } = await topBooking(api);
    const bookings = new BookingsPage(page);
    await bookings.goto();

    await bookings.table
      .row(booking.roomName)
      .getByRole('link', { name: printedRange(booking.startsAt, booking.endsAt, timeZone) })
      .click();
    const details = new BookingDetailsPage(page);
    await expect(page).toHaveURL(new RegExp(`/bookings/${booking.id}$`));
    await expect(details.heading).toHaveText(
      `${booking.roomName}, ${printedRange(booking.startsAt, booking.endsAt, timeZone)}`,
    );
    const day = printedDay(zonedDay(booking.startsAt, timeZone));
    await expect(details.value('Starts')).toHaveText(
      `${day}, ${clockIn(booking.startsAt, timeZone)}`,
    );
    await expect(details.value('Room')).toHaveText(booking.roomName);
    await expect(details.value('Member')).toContainText(booking.memberName);
  });
});

test.describe('creating', { tag: '@mutating' }, () => {
  test('books a room, then confirms the booking', async ({ page, api }) => {
    const { location, room, member } = await createBookable(api);
    const day = daysFromToday(30);
    const bookings = new BookingsPage(page);
    await bookings.goto();

    const form = await bookings.openNewBookingForm();
    await form.pick('Room', room.name, new RegExp(`^${room.name} · `));
    await form.pick('Member', member.lastName, new RegExp(`^Dana ${member.lastName} · `));
    await form.chooseDate(day);
    await form.setTimes('10:00', '11:30');
    await expect(form.dialog).toContainText(`${location.name} local time (${location.timezone})`);
    await form.submitAndClose();

    const details = new BookingDetailsPage(page);
    await expect(page).toHaveURL(/\/bookings\/\w+$/);
    await expect(details.heading).toHaveText(`${room.name}, ${printedDay(day)}, 10:00–11:30`);
    await expect(details.value('Status')).toHaveText('Pending');
    await expect(details.value('Price')).toHaveText('€37.50');
    await expect(details.value('Duration')).toHaveText('1.5 h');
    await expect(new Notifications(page).toast('Booking created')).toBeVisible();

    await details.move('Confirm').click();
    await expect(details.value('Status')).toHaveText('Confirmed');
    await expect(new Notifications(page).toast('Booking confirmed')).toBeVisible();
  });

  test('refuses an overlapping booking, names the one in the way and keeps the form open', async ({
    page,
    api,
  }) => {
    const { location, room, member } = await createBookable(api);
    const day = daysFromToday(20);
    const taken = await createBooking(api, {
      roomId: room.id,
      memberId: member.id,
      day,
      from: '09:00',
      to: '10:00',
    });
    const bookings = new BookingsPage(page);
    await bookings.goto();

    const form = await bookings.openNewBookingForm();
    await form.pick('Room', room.name, new RegExp(`^${room.name} · `));
    await form.pick('Member', member.lastName, new RegExp(`^Dana ${member.lastName} · `));
    await form.chooseDate(zonedDay(taken.startsAt, location.timezone));
    await form.setTimes(
      clockIn(taken.startsAt, location.timezone),
      clockIn(taken.endsAt, location.timezone),
    );
    await form.save.click();

    await expect(form.conflicts).toBeVisible();
    await expect(form.conflicts).toBeFocused();
    await expect(form.conflicts.getByRole('link')).toHaveAttribute('href', `/bookings/${taken.id}`);
    await expect(form.dialog).toBeVisible();
    await expect(new Notifications(page).toast(/Booking created/)).toHaveCount(0);

    // Moving the time out of the way is all it takes.
    await form.setTimes('15:00', '16:00');
    await form.submitAndClose();
    await expect(new Notifications(page).toast('Booking created')).toBeVisible();
  });

  test('says how many people the room seats, under the field', async ({ page, api }) => {
    const { room, member } = await createBookable(api, { capacity: 6 });
    const bookings = new BookingsPage(page);
    await bookings.goto();

    const form = await bookings.openNewBookingForm();
    await form.pick('Room', room.name, new RegExp(`^${room.name} · `));
    await form.pick('Member', member.lastName, new RegExp(`^Dana ${member.lastName} · `));
    await form.chooseDate(daysFromToday(12));
    await form.fill('Attendees', '7');
    await form.save.click();

    await form.expectFieldError('Attendees', /This room seats up to 6/);
    await expect(form.dialog).toBeVisible();
  });

  test('shows a time outside opening hours under the time field', async ({ page, api }) => {
    const { room, member } = await createBookable(api);
    const bookings = new BookingsPage(page);
    await bookings.goto();

    const form = await bookings.openNewBookingForm();
    await form.pick('Room', room.name, new RegExp(`^${room.name} · `));
    await form.pick('Member', member.lastName, new RegExp(`^Dana ${member.lastName} · `));
    await form.chooseDate(daysFromToday(12));
    await form.setTimes('06:00', '07:00');
    await form.save.click();

    await form.expectFieldError('From', /Outside opening hours \(08:00–20:00 local time\)/);
  });

  test('checks the times against each other and the date before asking', async ({ page, api }) => {
    const { room } = await createBookable(api);
    const bookings = new BookingsPage(page);
    await bookings.goto();
    const form = await bookings.openNewBookingForm();

    await form.save.click();
    await form.expectFieldError('Room', 'Choose a room');
    await form.expectFieldError('Member', 'Choose a member');
    await expect(form.dateButton).toHaveAccessibleDescription('Pick a date');

    await form.pick('Room', room.name, new RegExp(`^${room.name} · `));
    await form.setTimes('12:00', '11:00');
    await form.save.click();
    await form.expectFieldError('To', 'End must be after start');

    await form.setTimes('08:00', '18:00');
    await form.save.click();
    await form.expectFieldError('To', 'A booking cannot be longer than 8 hours');
  });
});

test.describe('status', { tag: '@mutating' }, () => {
  test('moves a booking from pending to completed, one step at a time', async ({ page, api }) => {
    const { room, member } = await createBookable(api);
    const booking = await createBooking(api, {
      roomId: room.id,
      memberId: member.id,
      day: daysFromToday(6),
    });
    await page.goto(`/bookings/${booking.id}`);
    const details = new BookingDetailsPage(page);
    await expect(details.value('Status')).toHaveText('Pending');

    await details.move('Confirm').click();
    await expect(details.value('Status')).toHaveText('Confirmed');
    await expect(details.move('Check in')).toBeVisible();
    await expect(details.move('No-show')).toBeVisible();

    await details.move('Check in').click();
    await expect(details.value('Status')).toHaveText('Checked in');

    await details.move('Complete').click();
    await expect(details.value('Status')).toHaveText('Completed');
    await expect(details.move('Complete')).toHaveCount(0);
    await expect(details.edit).toHaveCount(0);
    // The button that was pressed is gone, so the title takes the focus.
    await expect(details.heading).toBeFocused();
  });

  test('marks a confirmed booking as a no-show', async ({ page, api }) => {
    const { room, member } = await createBookable(api);
    const booking = await createBooking(api, {
      roomId: room.id,
      memberId: member.id,
      day: daysFromToday(6),
      status: 'confirmed',
    });
    await page.goto(`/bookings/${booking.id}`);
    const details = new BookingDetailsPage(page);

    await details.move('No-show').click();
    await expect(details.value('Status')).toHaveText('No show');
  });

  test('asks before it cancels, and cancels once it is told to', async ({ page, api }) => {
    const { room, member } = await createBookable(api);
    const booking = await createBooking(api, {
      roomId: room.id,
      memberId: member.id,
      day: daysFromToday(6),
    });
    await page.goto(`/bookings/${booking.id}`);
    const details = new BookingDetailsPage(page);
    await expect(details.value('Status')).toHaveText('Pending');

    const question = await details.askToCancel();
    await question.cancel.click();
    await question.expectClosed();
    await expect(details.value('Status')).toHaveText('Pending');

    await details.askToCancel();
    await question.confirm('Cancel booking');
    await question.expectClosed();
    await expect(details.value('Status')).toHaveText('Cancelled');
    await expect(details.cancelBooking).toHaveCount(0);
  });

  test('confirms a booking from its row in the list', async ({ page, api }) => {
    const { room, member } = await createBookable(api);
    await createBooking(api, { roomId: room.id, memberId: member.id, day: daysFromToday(6) });
    const bookings = new BookingsPage(page);
    await bookings.goto(query({ q: room.name }));

    await bookings.table
      .row(room.name)
      .getByRole('button', { name: /^Confirm: / })
      .click();
    await expect(bookings.table.row(room.name)).toContainText('Confirmed');
    await expect(new Notifications(page).toast('Booking confirmed')).toBeVisible();
  });

  test('edits a booking from the list', async ({ page, api }) => {
    const { location, room, member } = await createBookable(api);
    const booking = await createBooking(api, {
      roomId: room.id,
      memberId: member.id,
      day: daysFromToday(6),
    });
    const bookings = new BookingsPage(page);
    await bookings.goto(query({ q: room.name }));

    await bookings.table
      .row(room.name)
      .getByRole('button', { name: /^Edit booking: / })
      .click();
    const form = new BookingFormDialog(page, 'Edit booking');
    await form.expectOpen();
    await expect(form.field('Room')).toHaveValue(new RegExp(`^${room.name} · `));
    await form.setTimes('14:00', '16:00');
    await form.fill('Attendees', '3');
    await form.submitAndClose();

    const day = zonedDay(booking.startsAt, location.timezone);
    await expect(bookings.table.row(room.name)).toContainText(`${printedDay(day)}, 14:00–16:00`);
    await expect(new Notifications(page).toast('Booking updated')).toBeVisible();
  });
});

test.describe('bulk actions', { tag: '@mutating' }, () => {
  test('cancels the ticked bookings after asking', async ({ page, api }) => {
    const { room, member } = await createBookable(api);
    for (const days of [3, 4, 5]) {
      await createBooking(api, { roomId: room.id, memberId: member.id, day: daysFromToday(days) });
    }
    const bookings = new BookingsPage(page);
    await bookings.goto(query({ q: room.name, status: 'pending' }));
    await expect(bookings.table.rows).toHaveCount(3);

    await bookings.table.rows.nth(0).getByRole('checkbox').check();
    await bookings.table.rows.nth(1).getByRole('checkbox').check();
    await expect(bookings.selectedCount).toHaveText('2 selected');

    const question = await bookings.askToCancelSelected(2);
    await question.confirm('Cancel bookings');
    await question.expectClosed();

    await expect(new Notifications(page).toast('2 bookings cancelled')).toBeVisible();
    await expect(bookings.table.rows).toHaveCount(1);
    await expect(bookings.selectedCount).toHaveCount(0);
    await expect(bookings.heading).toBeFocused();
  });

  test('confirms what it can and lists what it could not', async ({ page, api }) => {
    const { room, member } = await createBookable(api);
    await createBooking(api, { roomId: room.id, memberId: member.id, day: daysFromToday(3) });
    await createBooking(api, {
      roomId: room.id,
      memberId: member.id,
      day: daysFromToday(4),
      status: 'completed',
    });
    const bookings = new BookingsPage(page);
    await bookings.goto(query({ q: room.name }));
    await expect(bookings.table.rows).toHaveCount(2);

    await bookings.table.selectAll.check();
    await expect(bookings.selectedCount).toHaveText('2 selected');
    await bookings.bulkConfirm.click();

    await expect(new Notifications(page).toast('1 booking confirmed')).toBeVisible();
    await expect(bookings.refused).toBeVisible();
    await expect(bookings.refused).toContainText('Cannot confirm a booking that is completed');

    await bookings.refused.getByRole('button', { name: 'Close' }).first().click();
    await expect(bookings.refused).toBeHidden();
    // What was refused stays ticked, for a look or another try.
    await expect(bookings.selectedCount).toHaveText('1 selected');
    await expect(bookings.table.row('Completed')).toBeVisible();
    await expect(bookings.table.row('Confirmed')).toBeVisible();
  });
});
