import type { Locator, Page } from '@playwright/test';

/** Search box and filters above a list. */
export class ListToolbar {
  readonly search: Locator;
  readonly clearFilters: Locator;
  private readonly page: Page;

  constructor(page: Page, searchLabel: string) {
    this.page = page;
    this.search = page.getByRole('searchbox', { name: searchLabel });
    this.clearFilters = page.getByRole('button', { name: 'Clear filters' });
  }

  /** A drop-down filter by its accessible name. */
  filter(label: string): Locator {
    return this.page.getByRole('combobox', { name: label, exact: true });
  }

  async choose(label: string, option: string): Promise<void> {
    await this.filter(label).click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }
}
