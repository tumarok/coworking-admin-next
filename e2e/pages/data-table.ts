import { expect, type Locator, type Page } from '@playwright/test';

/** The table of a list page and its pager. */
export class DataTable {
  readonly table: Locator;
  /** The rows of the body (the header row has no `cell`s). */
  readonly rows: Locator;
  /** "1–20 of 57". */
  readonly range: Locator;
  readonly pageLabel: Locator;
  readonly nextPage: Locator;
  readonly previousPage: Locator;
  readonly rowsPerPage: Locator;
  readonly selectAll: Locator;
  private readonly page: Page;

  constructor(page: Page, caption: string) {
    this.page = page;
    this.table = page.getByRole('table', { name: caption });
    this.rows = this.table.getByRole('row').filter({ has: page.getByRole('cell') });
    const pager = page.getByRole('navigation', { name: 'Pagination' });
    this.range = pager.getByText(/^\d+–\d+ of \d+$/);
    this.pageLabel = pager.getByText(/^Page \d+ of \d+$/);
    this.nextPage = pager.getByRole('button', { name: 'Next page' });
    this.previousPage = pager.getByRole('button', { name: 'Previous page' });
    this.rowsPerPage = pager.getByRole('combobox', { name: 'Rows per page' });
    this.selectAll = this.table.getByRole('checkbox', { name: 'Select all rows on this page' });
  }

  /** The row that holds this text. */
  row(text: string | RegExp): Locator {
    return this.rows.filter({ hasText: text });
  }

  link(name: string | RegExp): Locator {
    return this.table.getByRole('link', { name });
  }

  /** The tick box of the row that holds this text. */
  checkbox(rowText: string | RegExp): Locator {
    return this.row(rowText).getByRole('checkbox');
  }

  /** The list has been drawn: the table is no longer busy and the range says how much there is. */
  async expectLoaded(): Promise<void> {
    await expect(this.table).toBeVisible();
    await expect(this.table).not.toHaveAttribute('aria-busy', 'true');
    await expect(this.range).toBeVisible();
  }

  /** Says there is nothing to list: the only row is the page's own words for it. */
  async expectEmpty(message: string | RegExp): Promise<void> {
    await expect(this.table.getByRole('cell', { name: message })).toBeVisible();
    await expect(this.range).toHaveText('0–0 of 0');
  }

  /** How many records the pager says there are in all. */
  async total(): Promise<number> {
    await this.expectLoaded();
    const text = (await this.range.textContent()) ?? '';
    return Number(/of (\d+)$/.exec(text)?.[1]);
  }

  async selectRowsPerPage(size: number): Promise<void> {
    await this.rowsPerPage.click();
    await this.page.getByRole('option', { name: String(size), exact: true }).click();
  }
}
