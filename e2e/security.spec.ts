import { expect, test } from './fixtures';
import { BookingsPage } from './pages/bookings-page';
import { DashboardPage } from './pages/dashboard-page';
import { LocationsPage } from './pages/locations-page';
import { LoginPage } from './pages/login-page';
import { MembersPage } from './pages/members-page';
import { RoomsPage } from './pages/rooms-page';
import { AppShell } from './pages/shell';
import { ADMIN, NO_SESSION } from './support/auth';
import {
  firstOf,
  type BookingRecord,
  type LocationRecord,
  type MemberRecord,
  type RoomRecord,
} from './support/data';

const nonceOf = (policy: string | undefined) => /'nonce-([^']+)'/.exec(policy ?? '')?.[1];

test.describe('content security policy', () => {
  test('gives every page response its own nonce, and the scripts carry it', async ({ page }) => {
    const first = await page.goto('/');
    const policy = first?.headers()['content-security-policy'];
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).not.toContain('unsafe-eval');
    const nonce = nonceOf(policy);
    expect(nonce).toBeTruthy();

    await expect(new AppShell(page).heading('Dashboard')).toBeVisible();
    // Scripts added later by the ones that have the nonce need none (`strict-dynamic`).
    const inline = await page.evaluate(() =>
      [...document.scripts].filter((script) => !script.src).map((script) => script.nonce),
    );
    expect(inline.length).toBeGreaterThan(0);
    expect(new Set(inline)).toEqual(new Set([nonce]));

    const second = await page.reload();
    expect(nonceOf(second?.headers()['content-security-policy'])).not.toBe(nonce);
  });

  test('sets the security headers of the app on a page', async ({ page }) => {
    const response = await page.goto('/locations');
    expect(response?.headers()).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
    });
  });

  test('opens every screen, dialogs included, without a console error or a policy violation', async ({
    page,
    api,
  }) => {
    // Any error the page logs, a blocked script or style among them, fails the test (see fixtures).
    const [location, room, member, booking] = await Promise.all([
      firstOf<LocationRecord>(api, '/locations'),
      firstOf<RoomRecord>(api, '/rooms'),
      firstOf<MemberRecord>(api, '/members'),
      firstOf<BookingRecord>(api, '/bookings'),
    ]);
    const title = (name: string) => page.getByRole('heading', { name, level: 1 });
    const bookingTitle = page
      .getByRole('heading', { level: 1 })
      .filter({ hasText: booking.roomName });

    // A list page waits for its rows in `goto`; a details page shows its record's name once loaded.
    await new DashboardPage(page).goto();
    await new LocationsPage(page).goto();
    await page.goto(`/locations/${location.id}`);
    await expect(title(location.name)).toBeVisible();
    await new RoomsPage(page).goto();
    await page.goto(`/rooms/${room.id}`);
    await expect(title(room.name)).toBeVisible();
    await new MembersPage(page).goto();
    await page.goto(`/members/${member.id}`);
    await expect(title(`${member.firstName} ${member.lastName}`)).toBeVisible();
    await new BookingsPage(page).goto();
    await page.goto(`/bookings/${booking.id}`);
    await expect(bookingTitle).toBeVisible();

    const locations = new LocationsPage(page);
    await locations.goto();
    const form = await locations.openNewLocationForm();
    await form.cancel.click();
    const shell = new AppShell(page);
    await shell.themeToggle.click();
    await shell.themeToggle.click();
  });

  test.describe('without a session', () => {
    test.use({ storageState: NO_SESSION });

    test('opens the sign-in page without a console error or a policy violation', async ({
      page,
    }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.submit(ADMIN.email, 'wrong');
      await expect(login.alert).toBeVisible();
    });
  });
});

test.describe('BFF', () => {
  test('answers a signed-in request and forbids caching it', async ({ page }) => {
    const response = await page.request.get('/bff/locations?limit=1');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    const body = (await response.json()) as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(1);
  });

  test('turns a state-changing call from another origin down', async ({ page }) => {
    const response = await page.request.post('/bff/bookings/bulk', {
      data: { ids: [], action: 'confirm' },
      headers: { origin: 'https://example.com' },
    });
    expect(response.status()).toBe(403);
  });

  test.describe('without a session', () => {
    test.use({ storageState: NO_SESSION });

    test('answers 401 and forbids caching that too', async ({ page }) => {
      const response = await page.request.get('/bff/locations');
      expect(response.status()).toBe(401);
      expect(response.headers()['cache-control']).toContain('no-store');
    });
  });
});
