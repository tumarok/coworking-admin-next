import { expect, type Locator, type Page } from '@playwright/test';

import { DataTable } from './data-table';
import { RoomFormDialog } from './room-form-dialog';
import { searchAndPick } from './search-and-pick';
import { ListToolbar } from './toolbar';

/** `/rooms`. */
export class RoomsPage {
  readonly heading: Locator;
  readonly newRoom: Locator;
  readonly toolbar: ListToolbar;
  readonly table: DataTable;
  private readonly page: Page;
  /** The searchable location filter (a combobox with text), unlike the plain drop-down filters. */
  private readonly locationFilter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Rooms', level: 1 });
    this.newRoom = page.getByRole('button', { name: 'New room' });
    this.toolbar = new ListToolbar(page, 'Search name or location');
    this.table = new DataTable(page, 'Rooms');
    this.locationFilter = page.getByRole('combobox', { name: 'Location', exact: true });
  }

  async goto(query = ''): Promise<void> {
    await this.page.goto(`/rooms${query}`);
    await expect(this.heading).toBeVisible();
    await this.table.expectLoaded();
  }

  /** Finds a location with the search box of the filter and picks it. */
  async chooseLocation(location: { name: string; city: string }): Promise<void> {
    await searchAndPick(
      this.page,
      this.locationFilter,
      location.name,
      `${location.name} (${location.city})`,
    );
  }

  async openNewRoomForm(): Promise<RoomFormDialog> {
    await this.newRoom.click();
    const dialog = new RoomFormDialog(this.page, 'New room');
    await dialog.expectOpen();
    return dialog;
  }

  async openEditForm(name: string): Promise<RoomFormDialog> {
    await this.page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
    const dialog = new RoomFormDialog(this.page, `Edit ${name}`);
    await dialog.expectOpen();
    return dialog;
  }

  deleteButton(name: string): Locator {
    return this.page.getByRole('button', { name: `Delete ${name}`, exact: true });
  }
}
