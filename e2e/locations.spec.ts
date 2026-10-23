import { expect, test } from './fixtures';
import { ConfirmDialog } from './pages/confirm-dialog';
import { DetailsPage } from './pages/details-page';
import { LocationsPage } from './pages/locations-page';
import { Notifications } from './pages/notifications';
import { query, withQuery, withoutQuery } from './support/url';
import {
  createLocation,
  createRoom,
  firstOf,
  uniqueName,
  type LocationRecord,
  type PageOf,
} from './support/data';

test.describe('list', () => {
  test('lists the locations of the API with the pager saying how many', async ({ page, api }) => {
    const { total } = await api.get<PageOf<LocationRecord>>('/locations', { limit: 1 });
    const locations = new LocationsPage(page);
    await locations.goto();

    expect(await locations.table.total()).toBe(total);
    await expect(locations.table.rows).toHaveCount(Math.min(total, 20));
  });

  test('narrows the list with the search and writes it to the URL', async ({ page, api }) => {
    const location = await firstOf<LocationRecord>(api, '/locations');
    const locations = new LocationsPage(page);
    await locations.goto();

    await locations.toolbar.search.fill(location.name);
    await expect(page).toHaveURL(withQuery({ q: location.name }));
    await expect(locations.table.rows).toHaveCount(1);
    await expect(locations.table.row(location.name)).toBeVisible();
  });

  test('says so when nothing matches, and clears the filters', async ({ page }) => {
    const locations = new LocationsPage(page);
    await locations.goto();

    await locations.toolbar.search.fill('no such place anywhere');
    await locations.table.expectEmpty('No locations match the current filters.');

    await locations.toolbar.clearFilters.click();
    await expect(page).toHaveURL(withoutQuery);
    await expect(locations.toolbar.search).toHaveValue('');
    await expect(locations.table.rows.first()).toBeVisible();
  });

  test('filters by status', async ({ page, api }) => {
    const { total } = await api.get<PageOf<LocationRecord>>('/locations', {
      status: 'inactive',
      limit: 1,
    });
    const locations = new LocationsPage(page);
    await locations.goto();

    await locations.toolbar.choose('Status', 'Inactive');
    await expect(page).toHaveURL(withQuery({ status: 'inactive' }));
    await expect.poll(() => locations.table.total()).toBe(total);
    await expect(locations.table.rows.filter({ hasNotText: 'Inactive' })).toHaveCount(0);
  });

  test('restores the filters from the URL', async ({ page }) => {
    const locations = new LocationsPage(page);
    await locations.goto('?status=active');

    await expect(locations.toolbar.filter('Status')).toContainText('Active');
    await expect(locations.toolbar.clearFilters).toBeVisible();
  });
});

test.describe('details', () => {
  test('shows the fields of a location, reached from the list', async ({ page, api }) => {
    const location = await firstOf<LocationRecord & { address: string }>(api, '/locations');
    const locations = new LocationsPage(page);
    await locations.goto(query({ q: location.name }));

    await locations.table.link(location.name).click();
    const details = new DetailsPage(page);
    await expect(details.heading).toHaveText(location.name);
    await expect(page).toHaveURL(new RegExp(`/locations/${location.id}$`));
    await expect(details.value('City')).toHaveText(location.city);
    await expect(details.value('Address')).toHaveText(location.address);
    await expect(details.value('Time zone')).toHaveText(location.timezone);
  });
});

test.describe('editing', { tag: '@mutating' }, () => {
  test('creates a location and opens its page', async ({ page }) => {
    const name = uniqueName('Test Harbour');
    const locations = new LocationsPage(page);
    await locations.goto();

    const form = await locations.openNewLocationForm();
    await form.fill('Name', name);
    await form.fill('City', 'Kyiv');
    await form.fill('Address', '5 Test Embankment');
    await form.choose('Time zone', 'Europe/Warsaw');
    await form.fill('Opens at', '07:30');
    await form.fill('Closes at', '21:00');
    await form.submitAndClose();

    const details = new DetailsPage(page);
    await expect(details.heading).toHaveText(name);
    await expect(details.value('Time zone')).toHaveText('Europe/Warsaw');
    await expect(details.value('Opening hours')).toHaveText('07:30–21:00');
    await expect(details.value('Rooms')).toHaveText('0');
    await expect(new Notifications(page).toast('Location created')).toBeVisible();
  });

  test('explains what is wrong before saving and keeps the dialog open', async ({ page }) => {
    const locations = new LocationsPage(page);
    await locations.goto();
    const form = await locations.openNewLocationForm();

    await form.save.click();
    await form.expectFieldError('Name', 'At least 2 characters');
    await form.expectFieldError('City', 'At least 2 characters');
    await form.expectFieldError('Address', 'At least 5 characters');

    await form.fill('Name', 'Early Closing');
    await form.fill('City', 'Kyiv');
    await form.fill('Address', '1 Test Street');
    await form.fill('Opens at', '09:00');
    await form.fill('Closes at', '07:00');
    await form.save.click();
    await form.expectFieldError('Closes at', 'Closing time must be after opening time');
    await expect(form.dialog).toBeVisible();
  });

  test('leaves the list as it was when the dialog is cancelled', async ({ page, api }) => {
    const total = (await api.get<PageOf<LocationRecord>>('/locations', { limit: 1 })).total;
    const locations = new LocationsPage(page);
    await locations.goto();

    const form = await locations.openNewLocationForm();
    await form.fill('Name', 'Never Saved');
    await form.cancel.click();
    await form.expectClosed();

    expect(await locations.table.total()).toBe(total);
    await expect(locations.table.row('Never Saved')).toHaveCount(0);
  });

  test('edits a location from the list', async ({ page, api }) => {
    const location = await createLocation(api);
    const locations = new LocationsPage(page);
    await locations.goto(query({ q: location.name }));

    const form = await locations.openEditForm(location.name);
    await expect(form.field('Name')).toHaveValue(location.name);
    await form.fill('City', 'Odesa');
    await form.choose('Status', 'Inactive');
    await form.submitAndClose();

    const row = locations.table.row(location.name);
    await expect(row).toContainText('Odesa');
    await expect(row).toContainText('Inactive');
    await expect(new Notifications(page).toast('Location updated')).toBeVisible();
  });

  test('deletes a location without rooms from its page', async ({ page, api }) => {
    const location = await createLocation(api);
    await page.goto(`/locations/${location.id}`);
    const details = new DetailsPage(page);
    await expect(details.heading).toHaveText(location.name);

    await details.delete.click();
    const question = new ConfirmDialog(page, `Delete ${location.name}?`);
    await question.expectOpen();
    await question.confirm('Delete');

    await expect(page).toHaveURL(/\/locations$/);
    await expect(new Notifications(page).toast('Location deleted')).toBeVisible();
    const { items } = await api.get<PageOf<LocationRecord>>('/locations', { q: location.name });
    expect(items).toHaveLength(0);
  });

  test('refuses to delete a location that still has rooms', async ({ page, api }) => {
    const location = await createLocation(api);
    await createRoom(api, location.id);
    const locations = new LocationsPage(page);
    await locations.goto(query({ q: location.name }));

    await locations.deleteButton(location.name).click();
    const question = new ConfirmDialog(page, `Delete ${location.name}?`);
    await question.expectOpen();
    await question.confirm('Delete');

    await expect(question.alert).toHaveText('Remove or move the rooms of this location first');
    await expect(question.dialog).toBeVisible();
    await question.cancel.click();
    await question.expectClosed();
    await expect(locations.table.row(location.name)).toBeVisible();
  });
});
