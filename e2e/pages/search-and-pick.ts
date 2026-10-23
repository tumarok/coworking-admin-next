import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Picks a record from a drop-down that asks the server while it is typed into. The list keeps the
 * previous results until the new text has been sent and answered, and a click on one of those
 * lands on an option that is about to be replaced, so the option is taken only once the search
 * has finished.
 */
export async function searchAndPick(
  page: Page,
  combobox: Locator,
  search: string,
  option: string | RegExp,
): Promise<void> {
  await combobox.click();
  await combobox.fill(search);
  const searching = page.getByText('Searching…');
  await expect(searching).toBeVisible();
  await expect(searching).toBeHidden();
  await page.getByRole('option', { name: option }).click();
  await expect(page.getByRole('option', { name: option })).toBeHidden();
}
