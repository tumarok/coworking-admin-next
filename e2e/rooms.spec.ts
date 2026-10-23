import { expect, test } from './fixtures';
import { ConfirmDialog } from './pages/confirm-dialog';
import { DetailsPage } from './pages/details-page';
import { Notifications } from './pages/notifications';
import { RoomsPage } from './pages/rooms-page';
import {
  createBooking,
  createLocation,
  createMember,
  createRoom,
  firstOf,
  uniqueName,
  type LocationRecord,
  type RoomRecord,
  type PageOf,
} from './support/data';
import { daysFromToday } from './support/dates';
import { query, withQuery, withoutQuery } from './support/url';

type RoomView = RoomRecord & { type: string; hourlyRate: number; amenities: string[] };

test.describe('list', () => {
  test('lists the rooms of the API with the pager saying how many', async ({ page, api }) => {
    const { total } = await api.get<PageOf<RoomRecord>>('/rooms', { limit: 1 });
    const rooms = new RoomsPage(page);
    await rooms.goto();

    expect(await rooms.table.total()).toBe(total);
    await expect(rooms.table.rows).toHaveCount(Math.min(total, 20));
  });

  test('narrows the list by room name or by location name', async ({ page, api }) => {
    const room = await firstOf<RoomRecord>(api, '/rooms');
    const rooms = new RoomsPage(page);
    await rooms.goto();

    await rooms.toolbar.search.fill(room.name);
    await expect(page).toHaveURL(withQuery({ q: room.name }));
    await expect(rooms.table.row(room.name).first()).toBeVisible();

    await rooms.toolbar.search.fill(room.locationName);
    await expect(page).toHaveURL(withQuery({ q: room.locationName }));
    await expect(rooms.table.rows.filter({ hasNotText: room.locationName })).toHaveCount(0);
  });

  test('filters by type and by status', async ({ page, api }) => {
    const { total } = await api.get<PageOf<RoomRecord>>('/rooms', {
      type: 'private_office',
      status: 'available',
      limit: 1,
    });
    const rooms = new RoomsPage(page);
    await rooms.goto();

    await rooms.toolbar.choose('Type', 'Private office');
    await expect(page).toHaveURL(withQuery({ type: 'private_office' }));
    await rooms.toolbar.choose('Status', 'Available');
    await expect(page).toHaveURL(withQuery({ type: 'private_office', status: 'available' }));
    await expect.poll(() => rooms.table.total()).toBe(total);
    await expect(rooms.table.rows.filter({ hasNotText: 'Private office' })).toHaveCount(0);
  });

  test('filters by a location found with the search box of the filter', async ({ page, api }) => {
    const location = await firstOf<LocationRecord>(api, '/locations');
    const { total } = await api.get<PageOf<RoomRecord>>('/rooms', {
      locationId: location.id,
      limit: 1,
    });
    const rooms = new RoomsPage(page);
    await rooms.goto();

    await rooms.locationFilter.click();
    await rooms.locationFilter.fill(location.name);
    await page.getByRole('option', { name: `${location.name} (${location.city})` }).click();

    await expect(page).toHaveURL(withQuery({ locationId: location.id }));
    await expect.poll(() => rooms.table.total()).toBe(total);
    await expect(rooms.table.rows.filter({ hasNotText: location.name })).toHaveCount(0);

    await rooms.toolbar.clearFilters.click();
    await expect(page).toHaveURL(withoutQuery);
  });

  test('says so when nothing matches', async ({ page }) => {
    const rooms = new RoomsPage(page);
    await rooms.goto(query({ q: 'no such room anywhere' }));
    await rooms.table.expectEmpty('No rooms match the current filters.');
  });

  test('goes to the next page and back, keeping the page in the URL', async ({ page }) => {
    const rooms = new RoomsPage(page);
    await rooms.goto();

    await rooms.table.selectRowsPerPage(10);
    await expect(page).toHaveURL(withQuery({ limit: '10' }));
    await expect(rooms.table.range).toHaveText(/^1–10 of \d+$/);

    await rooms.table.nextPage.click();
    await expect(page).toHaveURL(withQuery({ limit: '10', page: '2' }));
    await expect(rooms.table.range).toHaveText(/^11–\d+ of \d+$/);
    await expect(rooms.table.pageLabel).toHaveText(/^Page 2 of \d+$/);

    await rooms.table.previousPage.click();
    await expect(rooms.table.range).toHaveText(/^1–10 of \d+$/);
  });
});

test.describe('details', () => {
  test('shows the fields of a room and leads to its location', async ({ page, api }) => {
    const room = await firstOf<RoomView>(api, '/rooms');
    const rooms = new RoomsPage(page);
    await rooms.goto(query({ q: room.name }));

    await rooms.table.link(room.name).first().click();
    const details = new DetailsPage(page);
    await expect(details.heading).toHaveText(room.name);
    await expect(details.value('Capacity')).toHaveText(`${room.capacity} seats`);
    await expect(details.value('Rate')).toContainText('/ hour');

    await details.value('Location').getByRole('link', { name: room.locationName }).click();
    await expect(page).toHaveURL(new RegExp(`/locations/${room.locationId}$`));
    await expect(details.heading).toHaveText(room.locationName);
  });
});

test.describe('editing', { tag: '@mutating' }, () => {
  test('creates a room with a rate in euros and opens its page', async ({ page, api }) => {
    const location = await createLocation(api);
    const name = uniqueName('Quartz');
    const rooms = new RoomsPage(page);
    await rooms.goto();

    const form = await rooms.openNewRoomForm();
    await form.pick('Location', location.name, `${location.name} (${location.city})`);
    await form.fill('Name', name);
    await form.choose('Type', 'Private office');
    await form.fill('Capacity', '4');
    await form.fill('Hourly rate', '32.5');
    await form.chooseAmenities('Whiteboard', 'Natural light');
    await form.submitAndClose();

    const details = new DetailsPage(page);
    await expect(details.heading).toHaveText(name);
    await expect(details.value('Type')).toHaveText('Private office');
    await expect(details.value('Capacity')).toHaveText('4 seats');
    await expect(details.value('Rate')).toHaveText('€32.50 / hour');
    await expect(details.value('Amenities').getByRole('listitem')).toHaveText([
      'Whiteboard',
      'Natural light',
    ]);
    await expect(new Notifications(page).toast('Room created')).toBeVisible();

    const { items } = await api.get<PageOf<RoomView>>('/rooms', { q: name });
    expect(items[0]).toMatchObject({ hourlyRate: 3250, locationId: location.id, capacity: 4 });
  });

  test('explains what is wrong before saving', async ({ page }) => {
    const rooms = new RoomsPage(page);
    await rooms.goto();
    const form = await rooms.openNewRoomForm();

    await form.save.click();
    await form.expectFieldError('Location', 'Choose a location');
    await form.expectFieldError('Name', 'At least 2 characters');

    await form.fill('Capacity', '0');
    await form.fill('Hourly rate', '12.345');
    await form.save.click();
    await form.expectFieldError('Capacity', /At least 1 seat/);
    await form.expectFieldError('Hourly rate', /At most 2 decimals/);
    await expect(form.dialog).toBeVisible();
  });

  test('edits a room from the list', async ({ page, api }) => {
    const location = await createLocation(api);
    const room = await createRoom(api, location.id);
    const rooms = new RoomsPage(page);
    await rooms.goto(query({ q: room.name }));

    const form = await rooms.openEditForm(room.name);
    await expect(form.field('Name')).toHaveValue(room.name);
    await expect(form.field('Location')).toHaveValue(`${location.name} (${location.city})`);
    await form.fill('Capacity', '9');
    await form.choose('Status', 'Maintenance');
    await form.submitAndClose();

    const row = rooms.table.row(room.name);
    await expect(row).toContainText('9');
    await expect(row).toContainText('Maintenance');
    await expect(new Notifications(page).toast('Room updated')).toBeVisible();
  });

  test('deletes a room from its page', async ({ page, api }) => {
    const location = await createLocation(api);
    const room = await createRoom(api, location.id);
    await page.goto(`/rooms/${room.id}`);
    const details = new DetailsPage(page);
    await expect(details.heading).toHaveText(room.name);

    await details.delete.click();
    const question = new ConfirmDialog(page, `Delete ${room.name}?`);
    await question.expectOpen();
    await question.confirm('Delete');

    await expect(page).toHaveURL(/\/rooms$/);
    await expect(new Notifications(page).toast('Room deleted')).toBeVisible();
    const { items } = await api.get<PageOf<RoomRecord>>('/rooms', { q: room.name });
    expect(items).toHaveLength(0);
  });

  test('refuses to delete a room that has upcoming bookings', async ({ page, api }) => {
    const location = await createLocation(api);
    const room = await createRoom(api, location.id);
    const member = await createMember(api);
    await createBooking(api, { roomId: room.id, memberId: member.id, day: daysFromToday(9) });
    const rooms = new RoomsPage(page);
    await rooms.goto(query({ q: room.name }));

    await rooms.deleteButton(room.name).click();
    const question = new ConfirmDialog(page, `Delete ${room.name}?`);
    await question.expectOpen();
    await question.confirm('Delete');

    await expect(question.alert).toHaveText('This room has upcoming bookings; cancel them first');
    await question.cancel.click();
    await expect(rooms.table.row(room.name)).toBeVisible();
  });
});
