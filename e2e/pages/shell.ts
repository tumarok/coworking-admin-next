import { expect, type Locator, type Page } from '@playwright/test';

/** The frame around every signed-in page: navigation, theme and the way out. */
export class AppShell {
  readonly nav: Locator;
  readonly signOut: Locator;
  readonly themeToggle: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.nav = page.getByRole('navigation', { name: 'Main' });
    this.signOut = page.getByRole('button', { name: 'Sign out' });
    this.themeToggle = page.getByRole('button', { name: 'Toggle dark mode' });
  }

  link(label: string): Locator {
    return this.nav.getByRole('link', { name: label, exact: true });
  }

  heading(name: string | RegExp): Locator {
    return this.page.getByRole('heading', { name, level: 1 });
  }

  /** The `<html>` element, which carries the `dark` class of the dark scheme. */
  get root(): Locator {
    return this.page.locator('html');
  }

  async expectDark(dark: boolean): Promise<void> {
    if (dark) await expect(this.root).toHaveClass(/(^|\s)dark(\s|$)/);
    else await expect(this.root).not.toHaveClass(/(^|\s)dark(\s|$)/);
  }
}
