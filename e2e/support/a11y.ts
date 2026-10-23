import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/** WCAG 2.0 and 2.1, levels A and AA, and axe's best practices. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

/**
 * Waits for the animations that end (a dialog opening, a panel fading in) so that axe reads the
 * final colours, not the ones halfway. Animations that never end (a spinner) are left.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const ending = document
      .getAnimations()
      .filter((animation) =>
        Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Infinity),
      );
    await Promise.all(ending.map((animation) => animation.finished.catch(() => undefined)));
  });
}

/**
 * Fails when axe finds a serious or critical violation on the page as it is now. Lesser ones are
 * attached to the test as annotations, so they are visible in the report without blocking.
 */
export async function expectNoBlockingA11y(page: Page, testInfo: TestInfo): Promise<void> {
  await settle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const describe = (violation: (typeof violations)[number]) => {
    const where = violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n');
    return `${violation.id} (${violation.impact ?? 'unrated'}): ${violation.help}\n${where}`;
  };
  const blocking = violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  for (const violation of violations) {
    if (!blocking.includes(violation)) {
      testInfo.annotations.push({ type: 'a11y', description: describe(violation) });
    }
  }
  expect(blocking.map(describe).join('\n\n'), 'Serious or critical accessibility violations').toBe(
    '',
  );
}
