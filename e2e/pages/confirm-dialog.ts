import { expect, type Locator, type Page } from '@playwright/test';

/** A question the app asks before something that cannot be undone. */
export class ConfirmDialog {
  readonly dialog: Locator;
  readonly cancel: Locator;
  /** Why the last attempt failed. */
  readonly alert: Locator;

  constructor(page: Page, title: string | RegExp) {
    this.dialog = page.getByRole('alertdialog', { name: title });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel', exact: true });
    this.alert = this.dialog.getByRole('alert');
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  async expectClosed(): Promise<void> {
    await expect(this.dialog).toBeHidden();
  }

  async confirm(label: string): Promise<void> {
    await this.dialog.getByRole('button', { name: label, exact: true }).click();
  }
}
