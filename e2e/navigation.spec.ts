import { expect, test } from './fixtures';
import { RoomsPage } from './pages/rooms-page';
import { AppShell } from './pages/shell';
import { withQuery } from './support/url';
import { firstOf, type RoomRecord } from './support/data';

test('moves between the sections and marks the current one', async ({ page }) => {
  const shell = new AppShell(page);
  await page.goto('/');
  await expect(shell.heading('Dashboard')).toBeVisible();
  await expect(shell.link('Dashboard')).toHaveAttribute('aria-current', 'page');

  for (const section of ['Locations', 'Rooms', 'Members', 'Bookings']) {
    await shell.link(section).click();
    await expect(shell.heading(section)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${section.toLowerCase()}$`));
    await expect(shell.link(section)).toHaveAttribute('aria-current', 'page');
    await expect(shell.link('Dashboard')).not.toHaveAttribute('aria-current', 'page');
  }
});

test('switches the dark scheme and remembers it after a reload', async ({ page }) => {
  const shell = new AppShell(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(shell.heading('Dashboard')).toBeVisible();
  await shell.expectDark(false);

  await shell.themeToggle.click();
  await shell.expectDark(true);

  await page.goto(page.url());
  await expect(shell.heading('Dashboard')).toBeVisible();
  await shell.expectDark(true);
});

test('follows the dark scheme of the system when the visitor has not chosen one', async ({
  page,
}) => {
  const shell = new AppShell(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(shell.heading('Dashboard')).toBeVisible();
  await shell.expectDark(true);
});

test('keeps list filters in the URL', async ({ page, api }) => {
  const room = await firstOf<RoomRecord>(api, '/rooms');
  const rooms = new RoomsPage(page);
  await rooms.goto();

  await rooms.toolbar.search.fill(room.name);
  await expect(page).toHaveURL(withQuery({ q: room.name }));
  await expect(rooms.table.row(room.name).first()).toBeVisible();

  await page.goto(page.url());
  await expect(rooms.toolbar.search).toHaveValue(room.name);
  await expect(rooms.table.row(room.name).first()).toBeVisible();
});

test.describe('not found', () => {
  test('shows a page for an unknown route', async ({ page }) => {
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found', level: 1 })).toBeVisible();

    await page.getByRole('link', { name: 'Back to dashboard' }).click();
    await expect(new AppShell(page).heading('Dashboard')).toBeVisible();
  });

  for (const [path, heading] of [
    ['/locations/loc_missing', 'Location not found'],
    ['/rooms/room_missing', 'Room not found'],
    ['/members/mem_missing', 'Member not found'],
    ['/bookings/bk_missing', 'Booking not found'],
  ] as const) {
    test(`explains a record that does not exist: ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible();
      await expect(page.getByRole('link', { name: /^All / })).toBeVisible();
    });
  }

  test('treats an id that cannot name a record as a missing page', async ({ page }) => {
    const response = await page.goto('/bookings/bad%20id');
    // The page streams, so the status is already 200 when the page finds the id unusable.
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Page not found', level: 1 })).toBeVisible();
  });
});
