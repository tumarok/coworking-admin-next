import type { Locator, Page } from '@playwright/test';

/** What the details page of any record has: a title, the way back, edit and delete, a field list. */
export class DetailsPage {
  readonly heading: Locator;
  readonly edit: Locator;
  readonly delete: Locator;
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.edit = page.getByRole('button', { name: 'Edit', exact: true });
    this.delete = page.getByRole('button', { name: 'Delete', exact: true });
  }

  /** The value shown for a field of the record, by the field's label. */
  value(label: string): Locator {
    return this.page
      .locator('dl > div')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .getByRole('definition');
  }
}
