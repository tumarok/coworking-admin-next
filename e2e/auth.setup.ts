import { expect, test as setup } from './fixtures';
import { LoginPage } from './pages/login-page';
import { ADMIN, AUTH_FILE, NO_SESSION, SESSION_COOKIE } from './support/auth';

setup.use({ storageState: NO_SESSION });

setup('signs in once for every project', async ({ page, context, api }) => {
  // The read-only projects read whatever the mock holds, so they start from its seeded data.
  await api.reset();
  const login = new LoginPage(page);
  await login.goto();
  await login.submit(ADMIN.email, ADMIN.password);
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

  const cookies = await context.cookies();
  const session = cookies.find((cookie) => cookie.name === SESSION_COOKIE);
  // The API token must never be readable by the page's scripts.
  expect(session?.httpOnly).toBe(true);

  await context.storageState({ path: AUTH_FILE });
});
