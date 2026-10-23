import { expect, type Locator, type Page } from '@playwright/test';

import { DataTable } from './data-table';
import { MemberFormDialog } from './member-form-dialog';
import { ListToolbar } from './toolbar';

/** `/members`. */
export class MembersPage {
  readonly heading: Locator;
  readonly newMember: Locator;
  readonly toolbar: ListToolbar;
  readonly table: DataTable;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Members', level: 1 });
    this.newMember = page.getByRole('button', { name: 'New member' });
    this.toolbar = new ListToolbar(page, 'Search name, email or company');
    this.table = new DataTable(page, 'Members');
  }

  async goto(query = ''): Promise<void> {
    await this.page.goto(`/members${query}`);
    await expect(this.heading).toBeVisible();
    await this.table.expectLoaded();
  }

  async openNewMemberForm(): Promise<MemberFormDialog> {
    await this.newMember.click();
    const dialog = new MemberFormDialog(this.page, 'New member');
    await dialog.expectOpen();
    return dialog;
  }

  async openEditForm(fullName: string): Promise<MemberFormDialog> {
    await this.page.getByRole('button', { name: `Edit ${fullName}`, exact: true }).click();
    const dialog = new MemberFormDialog(this.page, `Edit ${fullName}`);
    await dialog.expectOpen();
    return dialog;
  }

  deleteButton(fullName: string): Locator {
    return this.page.getByRole('button', { name: `Delete ${fullName}`, exact: true });
  }
}
