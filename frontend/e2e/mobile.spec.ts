import { expect, test } from '@playwright/test';
import { DESIGN_TIME, mockMarket, row, waitForData } from './support';

test.describe('Mobile (doc 1C)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(DESIGN_TIME);
    await mockMarket(page, { serverTime: DESIGN_TIME });
    await page.goto('/');
    await waitForData(page);
  });

  test('fits the screen: no sideways page scroll, nothing overlaps in the header', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const title = await page.getByRole('heading', { name: 'Market Watch' }).boundingBox();
    const status = await page.locator('header [role="status"]').boundingBox();
    const clock = await page.locator('header time').boundingBox();
    expect(title!.x + title!.width).toBeLessThan(Math.min(status!.x, clock!.x));

    await page.screenshot({
      path: 'test-results/screenshots/mobile-375.png',
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('the table scrolls sideways by touch while the first three columns stay put', async ({
    page,
    browserName,
  }) => {
    const reliance = row(page, 'RELIANCE');
    const cells = reliance.locator('[role="rowheader"], [role="cell"]');
    const before = await cells.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left)),
    );

    if (browserName === 'chromium') {
      // A real finger swipe, right to left, through Chromium's native touch scrolling.
      const box = (await page.locator('[role="table"]').boundingBox())!;
      const y = Math.round(box.y + 120);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 320, y }] });
      for (let step = 1; step <= 12; step += 1) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: 320 - step * 20, y }],
        });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(600); // let the fling settle
    } else {
      // Playwright can't synthesise swipes outside Chromium; scroll the same container instead.
      await page.locator('[role="table"]').evaluate((table) => table.parentElement!.scrollBy(240, 0));
      await page.waitForTimeout(100);
    }

    const after = await cells.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left)),
    );
    expect(after.slice(0, 3)).toEqual(before.slice(0, 3));
    expect(after[3]!).toBeLessThan(before[3]! - 100);

    await page.screenshot({
      path: 'test-results/screenshots/mobile-375-scrolled.png',
      animations: 'disabled',
    });
  });

  test('the dropdown opens, selects and deselects by tap', async ({ page }) => {
    await page.getByRole('button', { name: 'Select Stocks' }).tap();
    const option = page.getByRole('option', { name: /^LT/ });
    await option.tap();
    await expect(row(page, 'LT')).toBeVisible();

    const panel = (await page.getByRole('listbox').boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(375);
    await page.screenshot({
      path: 'test-results/screenshots/mobile-375-dropdown.png',
      animations: 'disabled',
    });

    await option.tap();
    await expect(row(page, 'LT')).toHaveCount(0);
  });
});
