import type { Locator, Page } from '@playwright/test';

/** The toasts of the app (sonner keeps them in a labelled region). */
export class Notifications {
  readonly region: Locator;

  constructor(page: Page) {
    this.region = page.getByRole('region', { name: /^Notifications/ });
  }

  toast(text: string | RegExp): Locator {
    return this.region.getByRole('listitem').filter({ hasText: text });
  }
}
