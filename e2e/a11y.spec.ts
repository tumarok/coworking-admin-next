import type { Page, TestInfo } from '@playwright/test';

import { expect, test } from './fixtures';
import { BookingsPage } from './pages/bookings-page';
import { ConfirmDialog } from './pages/confirm-dialog';
import { DashboardPage } from './pages/dashboard-page';
import { LocationsPage } from './pages/locations-page';
import { LoginPage } from './pages/login-page';
import { MembersPage } from './pages/members-page';
import { RoomsPage } from './pages/rooms-page';
import { AppShell } from './pages/shell';
import { expectNoBlockingA11y } from './support/a11y';
import { ADMIN, NO_SESSION } from './support/auth';
import {
  firstOf,
  type BookingRecord,
  type LocationRecord,
  type MemberRecord,
  type RoomRecord,
} from './support/data';

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${scheme} scheme`, { tag: '@a11y' }, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
    });

    // Each page is checked once its content is on screen (axe on a skeleton proves nothing) and
    // once the scheme under test is the one on screen: a run meant to be dark must not be light.
    const check = async (page: Page, testInfo: TestInfo) => {
      await new AppShell(page).expectDark(scheme === 'dark');
      await expectNoBlockingA11y(page, testInfo);
    };

    test.describe('signed out', () => {
      test.use({ storageState: NO_SESSION });

      test('login page', async ({ page }, testInfo) => {
        await new LoginPage(page).goto();
        await check(page, testInfo);
      });

      test('login page with an error', async ({ page }, testInfo) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.submit(ADMIN.email, 'wrong');
        await expect(login.alert).toBeVisible();
        await check(page, testInfo);
      });
    });

    test('dashboard', async ({ page }, testInfo) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await expect(dashboard.upcoming.first()).toBeVisible();
      await check(page, testInfo);
    });

    test('locations list', async ({ page }, testInfo) => {
      await new LocationsPage(page).goto();
      await check(page, testInfo);
    });

    test('rooms list', async ({ page }, testInfo) => {
      await new RoomsPage(page).goto();
      await check(page, testInfo);
    });

    test('members list', async ({ page }, testInfo) => {
      await new MembersPage(page).goto();
      await check(page, testInfo);
    });

    test('bookings list', async ({ page }, testInfo) => {
      const bookings = new BookingsPage(page);
      await bookings.goto();
      await check(page, testInfo);
    });

    test('bookings list with rows ticked', async ({ page }, testInfo) => {
      const bookings = new BookingsPage(page);
      await bookings.goto();
      await bookings.table.rows.nth(0).getByRole('checkbox').check();
      await expect(bookings.selectedCount).toHaveText('1 selected');
      await check(page, testInfo);
    });

    test('list with nothing found', async ({ page }, testInfo) => {
      const rooms = new RoomsPage(page);
      await rooms.goto('?q=nothing+is+called+this');
      await rooms.table.expectEmpty('No rooms match the current filters.');
      await check(page, testInfo);
    });

    test('a filter drop-down open', async ({ page }, testInfo) => {
      const rooms = new RoomsPage(page);
      await rooms.goto();
      await rooms.toolbar.filter('Type').click();
      await expect(page.getByRole('option', { name: 'Hot desk' })).toBeVisible();
      await check(page, testInfo);
    });

    test('location details', async ({ page, api }, testInfo) => {
      const location = await firstOf<LocationRecord>(api, '/locations');
      await page.goto(`/locations/${location.id}`);
      await expect(page.getByRole('heading', { name: location.name, level: 1 })).toBeVisible();
      await check(page, testInfo);
    });

    test('room details', async ({ page, api }, testInfo) => {
      const room = await firstOf<RoomRecord>(api, '/rooms');
      await page.goto(`/rooms/${room.id}`);
      await expect(page.getByRole('heading', { name: room.name, level: 1 })).toBeVisible();
      await check(page, testInfo);
    });

    test('member details', async ({ page, api }, testInfo) => {
      const member = await firstOf<MemberRecord>(api, '/members');
      await page.goto(`/members/${member.id}`);
      await expect(
        page.getByRole('heading', { name: `${member.firstName} ${member.lastName}`, level: 1 }),
      ).toBeVisible();
      await check(page, testInfo);
    });

    test('booking details', async ({ page, api }, testInfo) => {
      const booking = await firstOf<BookingRecord>(api, '/bookings');
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(booking.roomName);
      await check(page, testInfo);
    });

    test('record not found', async ({ page }, testInfo) => {
      await page.goto('/bookings/bk_missing');
      await expect(page.getByRole('heading', { name: 'Booking not found' })).toBeVisible();
      await check(page, testInfo);
    });

    test('page not found', async ({ page }, testInfo) => {
      await page.goto('/no-such-page');
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
      await check(page, testInfo);
    });

    test('location form', async ({ page }, testInfo) => {
      const locations = new LocationsPage(page);
      await locations.goto();
      const form = await locations.openNewLocationForm();
      await form.save.click();
      await form.expectFieldError('Name', 'At least 2 characters');
      await check(page, testInfo);
    });

    test('room form with a drop-down open', async ({ page }, testInfo) => {
      const rooms = new RoomsPage(page);
      await rooms.goto();
      const form = await rooms.openNewRoomForm();
      await form.field('Type').click();
      await expect(page.getByRole('option', { name: 'Hot desk' })).toBeVisible();
      await check(page, testInfo);
    });

    test('member form', async ({ page }, testInfo) => {
      const members = new MembersPage(page);
      await members.goto();
      const form = await members.openNewMemberForm();
      await form.save.click();
      await form.expectFieldError('Email', 'Enter a valid email');
      await check(page, testInfo);
    });

    test('booking form with the calendar open', async ({ page }, testInfo) => {
      const bookings = new BookingsPage(page);
      await bookings.goto();
      const form = await bookings.openNewBookingForm();
      await form.dateButton.click();
      await expect(page.getByRole('button', { name: 'Go to the Next Month' })).toBeVisible();
      await check(page, testInfo);
    });

    test('confirmation dialog', async ({ page, api }, testInfo) => {
      const location = await firstOf<LocationRecord>(api, '/locations');
      const locations = new LocationsPage(page);
      await locations.goto();
      await locations.deleteButton(location.name).click();
      await new ConfirmDialog(page, `Delete ${location.name}?`).expectOpen();
      await check(page, testInfo);
    });
  });
}
