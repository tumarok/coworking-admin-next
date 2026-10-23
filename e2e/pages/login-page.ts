import { expect, type Locator, type Page } from '@playwright/test';

/** `/login`: the form, its messages and the way in. */
export class LoginPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly signIn: Locator;
  /** What the server or the session said about the last attempt. */
  readonly alert: Locator;
  readonly notice: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Sign in', level: 1 });
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password', { exact: true });
    this.signIn = page.getByRole('button', { name: /^(Sign in|Signing in…)$/ });
    // Next keeps its own live region (a route announcer) with the same role outside the form.
    const form = page.getByRole('form', { name: 'Sign in' });
    this.alert = form.getByRole('alert');
    this.notice = form.getByRole('status');
  }

  async goto(query = ''): Promise<void> {
    await this.page.goto(`/login${query}`);
    await expect(this.heading).toBeVisible();
  }

  async fill(email: string, password: string): Promise<void> {
    // The form hydrates after it is drawn; typing earlier would be lost to the re-render.
    await expect(this.email).toBeFocused();
    await this.email.fill(email);
    await this.password.fill(password);
  }

  async submit(email: string, password: string): Promise<void> {
    await this.fill(email, password);
    await this.signIn.click();
  }
}
