import { expect, type Locator, type Page } from '@playwright/test';

import { searchAndPick } from './search-and-pick';

/** What every form dialog has: a title, Save and Cancel, errors under fields and a banner. */
export abstract class FormDialog {
  readonly dialog: Locator;
  readonly save: Locator;
  readonly cancel: Locator;
  protected readonly page: Page;

  constructor(page: Page, title: string | RegExp) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: title });
    this.save = this.dialog.getByRole('button', { name: 'Save', exact: true });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel', exact: true });
  }

  /** The control the dialog puts focus on when it opens: the first one. */
  protected abstract get initialFocus(): Locator;

  /**
   * Waits until the dialog is ready to be filled in. It is on screen before it is ready: the form
   * may still be waiting for data, and a field typed into before the dialog has moved focus to its
   * first control would lose its text to the re-render.
   */
  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
    await expect(this.initialFocus).toBeFocused();
  }

  async expectClosed(): Promise<void> {
    await expect(this.dialog).toBeHidden();
  }

  /** Saves and waits for the dialog to close: the record was accepted. */
  async submitAndClose(): Promise<void> {
    await this.save.click();
    await this.expectClosed();
  }

  /** A field by its label; a required one has a star after the text, which is not its name. */
  field(label: string): Locator {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.dialog.getByLabel(new RegExp(`^${escaped}\\*?$`));
  }

  /** The message under a field is its accessible description; a hint joins it. */
  async expectFieldError(label: string, message: string | RegExp): Promise<void> {
    const field = this.field(label);
    await expect(field).toHaveAccessibleDescription(message);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
  }

  async fill(label: string, value: string): Promise<void> {
    await this.field(label).fill(value);
  }

  /** Picks an option of a drop-down field. */
  async choose(label: string, option: string): Promise<void> {
    await this.field(label).click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }

  /**
   * Picks a record from a drop-down that asks the server: types to narrow the list, then takes the
   * option whose name matches.
   */
  async pick(label: string, search: string, option: string | RegExp): Promise<void> {
    await searchAndPick(this.page, this.field(label), search, option);
  }
}
