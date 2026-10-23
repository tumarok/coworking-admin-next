import { expect, test } from './fixtures';
import { LoginPage } from './pages/login-page';
import { Notifications } from './pages/notifications';
import { RoomsPage } from './pages/rooms-page';
import { AppShell } from './pages/shell';
import { ADMIN, NO_SESSION, SESSION_COOKIE } from './support/auth';

test.describe('signed out', () => {
  test.use({ storageState: NO_SESSION });

  test('sends a visitor to the login page and back after signing in', async ({ page }) => {
    const login = new LoginPage(page);
    await page.goto('/members');
    await expect(page).toHaveURL(/\/login\?from=%2Fmembers$/);

    await login.submit(ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/members$/);
    await expect(new AppShell(page).heading('Members')).toBeVisible();
  });

  test('shows a wrong password inside the form, not in a toast', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.submit(ADMIN.email, 'not-the-password');

    await expect(login.alert).toHaveText('Invalid email or password');
    await expect(login.password).toBeFocused();
    await expect(page).toHaveURL(/\/login$/);
    await expect(new Notifications(page).region.getByRole('listitem')).toHaveCount(0);
  });

  test('checks the form before it asks the server', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn.click();

    await expect(page.getByText('Enter a valid email')).toBeVisible();
    await expect(page.getByText('Enter your password')).toBeVisible();
    await expect(login.email).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('can show the password that is being typed', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.password.fill('secret');
    await expect(login.password).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(login.password).toHaveAttribute('type', 'text');
  });

  test('returns to the page that was asked for, with its filters', async ({ page }) => {
    const login = new LoginPage(page);
    await page.goto('/rooms?type=meeting_room&q=a');
    await expect(login.heading).toBeVisible();

    await login.submit(ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/rooms\?type=meeting_room&q=a$/);
    await expect(page.getByRole('combobox', { name: 'Type', exact: true })).toContainText(
      'Meeting room',
    );
  });

  test('does not follow a `from` that leaves the app', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto('?from=https%3A%2F%2Fexample.com%2F');
    await login.submit(ADMIN.email, ADMIN.password);

    await expect(page).toHaveURL(/\/$/);
    await expect(new AppShell(page).heading('Dashboard')).toBeVisible();
  });

  test('says so when the API rejects the session, and signing in again works', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: SESSION_COOKIE, value: 'demo-token.nobody', url: baseURL ?? '', httpOnly: true },
    ]);
    const login = new LoginPage(page);
    await page.goto('/locations');

    await expect(page).toHaveURL(/\/login\?expired=1$/);
    await expect(login.notice).toHaveText('Your session has expired. Sign in again.');

    await login.submit(ADMIN.email, ADMIN.password);
    await expect(new AppShell(page).heading('Dashboard')).toBeVisible();
  });
});

test('signs out, and the pages are closed again', async ({ page }) => {
  const shell = new AppShell(page);
  await page.goto('/');
  await expect(shell.heading('Dashboard')).toBeVisible();

  await shell.signOut.click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.context().cookies()).some(({ name }) => name === SESSION_COOKIE)).toBe(false);

  await page.goto('/bookings');
  await expect(page).toHaveURL(/\/login\?from=%2Fbookings$/);
});

test('sends a signed-in visitor from the login page to the dashboard', async ({ page }) => {
  await page.goto('/login');
  await expect(new AppShell(page).heading('Dashboard')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('leaves the session when the API turns the token down while a page is open', async ({
  page,
  context,
  baseURL,
}) => {
  const rooms = new RoomsPage(page);
  await rooms.goto();

  await context.addCookies([
    { name: SESSION_COOKIE, value: 'demo-token.nobody', url: baseURL ?? '', httpOnly: true },
  ]);
  // The list asks the API again for what was typed; the answer is 401.
  await rooms.toolbar.search.fill('a');

  await expect(page).toHaveURL(/\/login/);
  await expect(new LoginPage(page).heading).toBeVisible();
});

test('keeps the session token out of reach of scripts', async ({ page }) => {
  await page.goto('/');
  await expect(new AppShell(page).heading('Dashboard')).toBeVisible();

  const cookie = (await page.context().cookies()).find(({ name }) => name === SESSION_COOKIE);
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });

  const visible = await page.evaluate(() => ({
    cookies: document.cookie,
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  const token = cookie?.value ?? '';
  expect(token).not.toBe('');
  expect(visible.cookies).not.toContain(token);
  expect(visible.local).not.toContain(token);
  expect(visible.session).not.toContain(token);
});
