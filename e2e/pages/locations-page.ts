import { expect, type Locator, type Page } from '@playwright/test';

import { DataTable } from './data-table';
import { LocationFormDialog } from './location-form-dialog';
import { ListToolbar } from './toolbar';

/** `/locations`. */
export class LocationsPage {
  readonly heading: Locator;
  readonly newLocation: Locator;
  readonly toolbar: ListToolbar;
  readonly table: DataTable;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Locations', level: 1 });
    this.newLocation = page.getByRole('button', { name: 'New location' });
    this.toolbar = new ListToolbar(page, 'Search name, city or address');
    this.table = new DataTable(page, 'Locations');
  }

  async goto(query = ''): Promise<void> {
    await this.page.goto(`/locations${query}`);
    await expect(this.heading).toBeVisible();
    await this.table.expectLoaded();
  }

  async openNewLocationForm(): Promise<LocationFormDialog> {
    await this.newLocation.click();
    const dialog = new LocationFormDialog(this.page, 'New location');
    await dialog.expectOpen();
    return dialog;
  }

  async openEditForm(name: string): Promise<LocationFormDialog> {
    await this.page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
    const dialog = new LocationFormDialog(this.page, `Edit ${name}`);
    await dialog.expectOpen();
    return dialog;
  }

  deleteButton(name: string): Locator {
    return this.page.getByRole('button', { name: `Delete ${name}`, exact: true });
  }
}
