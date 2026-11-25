import { expect, test, type Page } from '@playwright/test';
import {
  DESIGN_ROWS,
  DESIGN_TIME,
  mockMarket,
  renderCounts,
  resetRenderCounts,
  row,
  waitForData,
} from './support';

const HEADERS = [
  'Symbol',
  'Company',
  'LTP',
  'Change %',
  '',
  'Day High',
  'Day Low',
  'Volume',
  '52W High',
  '52W Low',
];

test.describe('UI accuracy (doc 1C)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(DESIGN_TIME);
  });

  test('renders the reference content exactly', async ({ page }) => {
    await mockMarket(page, { serverTime: DESIGN_TIME });
    await page.goto('/');
    await waitForData(page);

    const header = page.locator('header');
    await expect(header.getByRole('heading', { name: 'Market Watch' })).toBeVisible();
    await expect(header.getByRole('status')).toHaveText('Live');
    await expect(header.locator('time')).toHaveText('Nov 17, 202502:30:45 PM');
    await expect(page.getByText('Select Stocks', { exact: true })).toBeVisible();

    const chips = page.getByRole('list', { name: 'Selected stocks' }).locator('li');
    await expect(chips).toHaveText(['RELIANCE', 'TCS', 'HDFCBANK', '+6']);

    // Visually: ten columns, including the reference's unlabelled spacer.
    await expect(page.locator('[role="columnheader"]')).toHaveText(HEADERS);
    // To assistive tech the spacer is hidden, leaving nine named columns.
    await expect(page.getByRole('columnheader')).toHaveText(HEADERS.filter(Boolean));
    await expect(page.locator('[role="row"][data-symbol]')).toHaveCount(9);
    await expect(page.locator('[role="rowheader"]')).toHaveText(DESIGN_ROWS.map((r) => r.s));

    const cells = (symbol: string) => row(page, symbol).locator('[role="rowheader"], [role="cell"]');
    await expect(cells('RELIANCE')).toHaveText([
      'RELIANCE',
      'Reliance Industries',
      '₹ 1,425.60',
      /\+2\.35%/,
      '',
      '₹ 1,430.00',
      '₹ 1,398.20',
      '12.5M',
      '₹ 1,620.00',
      '₹ 1,210.30',
    ]);
    await expect(cells('KOTAKBANK').nth(3)).toHaveText(/-1\.12%/);
  });

  test('matches the reference image pixel for pixel (within anti-aliasing tolerance)', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'The pixel baseline is a Chromium rendering; other engines run the ±3px geometry test.',
    );
    await mockMarket(page, { serverTime: DESIGN_TIME });
    await page.goto('/');
    await waitForData(page);
    await page.screenshot({ path: 'test-results/screenshots/desktop-1536.png', animations: 'disabled' });

    // The baseline is the image from the problem statement itself.
    // The tolerance covers font rasterisation and the three known deviations
    // listed in the README (row heights, "+2" vs "+6", scrollbar thumb length).
    await expect(page).toHaveScreenshot('reference-1536.png', {
      maxDiffPixelRatio: 0.065,
      threshold: 0.25,
    });
  });

  test('every box sits where the reference puts it (±3px)', async ({ page, browserName }) => {
    await mockMarket(page, { serverTime: DESIGN_TIME });
    await page.goto('/');
    await waitForData(page);

    // Measured from reference/market-watch.png (see README, "UI accuracy").
    const REF = {
      card: { x: 21, y: 25, width: 1496 },
      header: { height: 88 },
      field: { x: 226, y: 139, width: 641, height: 62 },
      headRow: { y: 228, height: 69 },
      columnEdges: [21, 182, 417, 557, 700, 825, 976, 1116, 1241, 1381],
      bodyBottom: 878,
      scrollTrack: { y: 896, height: 21 },
    };
    const near = (actual: number, expected: number, label: string) =>
      expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(3);

    const card = (await page.locator('main').boundingBox())!;
    near(card.x, REF.card.x, 'card x');
    near(card.y, REF.card.y, 'card y');
    near(card.width, REF.card.width, 'card width');

    const header = (await page.locator('header').boundingBox())!;
    near(header.height, REF.header.height, 'header height');

    const field = (await page.getByRole('list', { name: 'Selected stocks' }).locator('..').boundingBox())!;
    near(field.x, REF.field.x, 'field x');
    near(field.y, REF.field.y, 'field y');
    near(field.width, REF.field.width, 'field width');
    near(field.height, REF.field.height, 'field height');

    const headRow = (await page.locator('[role="row"]').first().boundingBox())!;
    near(headRow.y, REF.headRow.y, 'header row y');
    near(headRow.height, REF.headRow.height, 'header row height');

    const edges = await page
      .locator('[role="columnheader"]')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));
    edges.forEach((x, i) => near(x, REF.columnEdges[i]!, `column ${i} left edge`));

    const lastRow = (await page.locator('[role="row"][data-symbol]').last().boundingBox())!;
    near(lastRow.y + lastRow.height, REF.bodyBottom, 'last row bottom');

    // The 21px styled track exists only where ::-webkit-scrollbar does (Chromium, Safari).
    // Firefox draws its own native scrollbar, whose size the page cannot set.
    if (browserName !== 'firefox') {
      const scroller = (await page.locator('[role="table"]').locator('..').boundingBox())!;
      near(scroller.y + scroller.height - REF.scrollTrack.height, REF.scrollTrack.y, 'scrollbar track top');
    }
  });
});

test.describe('Market watch table (doc 1A)', () => {
  test('keeps Symbol, Company and LTP fixed while the other columns scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await mockMarket(page);
    await page.goto('/');
    await waitForData(page);

    const reliance = row(page, 'RELIANCE');
    const xOf = async () =>
      reliance
        .locator('[role="rowheader"], [role="cell"]')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));

    const before = await xOf();
    const scrolled = await page.locator('[role="table"]').evaluate((table) => {
      const scroller = table.parentElement!;
      scroller.scrollLeft = 300;
      return scroller.scrollLeft;
    });
    expect(scrolled).toBeGreaterThan(100);
    await page.waitForTimeout(50);
    const after = await xOf();

    expect(after.slice(0, 3)).toEqual(before.slice(0, 3)); // sticky block did not move
    for (let i = 3; i < after.length; i += 1) expect(after[i]).toBe(before[i]! - scrolled);

    // The sticky header cells stay aligned with the sticky body cells.
    const headX = await page
      .getByRole('columnheader')
      .evaluateAll((els) => els.slice(0, 3).map((el) => Math.round(el.getBoundingClientRect().left)));
    expect(headX).toEqual(after.slice(0, 3));
  });

  test('a tick re-renders only the cells whose value changed', async ({ page }) => {
    const market = await mockMarket(page);
    await page.goto('/');
    await waitForData(page);
    await resetRenderCounts(page);

    // 1. TCS price moves: one cell.
    market.tick([{ ...market.latest('TCS'), ltp: 3470.05 }]);
    await expect(row(page, 'TCS')).toContainText('₹ 3,470.05');
    expect(await renderCounts(page)).toEqual({ 'TCS:ltp': 1 });

    // 2. Volume grows but still reads "8.7M", and HDFC's change % moves: one cell.
    await resetRenderCounts(page);
    market.tick([
      { ...market.latest('TCS'), vol: 8_700_150 },
      { ...market.latest('HDFCBANK'), chg: -0.7 },
    ]);
    await expect(row(page, 'HDFCBANK')).toContainText('-0.70%');
    expect(await renderCounts(page)).toEqual({ 'HDFCBANK:changePct': 1 });

    // 3. A burst touching every stock re-renders exactly the changed fields.
    await resetRenderCounts(page);
    market.tick(
      DESIGN_ROWS.map((r) => {
        const q = market.latest(r.s);
        return { ...q, ltp: Math.round((q.ltp + 0.05) * 100) / 100 };
      }),
    );
    await expect(row(page, 'KOTAKBANK')).toContainText('₹ 2,028.75');
    const counts = await renderCounts(page);
    expect(Object.keys(counts).sort()).toEqual(DESIGN_ROWS.map((r) => `${r.s}:ltp`).sort());
    expect(Object.values(counts).every((n) => n === 1)).toBe(true);
  });
});

test.describe('Stock selection (doc 1B)', () => {
  test('adding and removing stocks updates the table and the subscription, leaving other rows alone', async ({
    page,
  }) => {
    const market = await mockMarket(page);
    await page.goto('/');
    await waitForData(page);
    await resetRenderCounts(page);

    // Add LT from the dropdown: it appears as the last row with live data.
    await page.getByRole('button', { name: 'Select Stocks' }).click();
    await page.getByRole('option', { name: /^LT/ }).click();
    await expect(row(page, 'LT')).toContainText('₹ 3,540.00');
    await expect(page.locator('[role="rowheader"]').last()).toHaveText('LT');
    expect(market.sent).toContainEqual({ event: 'subscribe', data: { symbols: ['LT'] } });

    const afterAdd = await renderCounts(page);
    expect(Object.keys(afterAdd).filter((k) => !k.startsWith('LT:'))).toEqual([]);

    // Deselect it again: the row disappears at once and the server is told.
    await resetRenderCounts(page);
    await page.getByRole('option', { name: /^LT/ }).click();
    await expect(row(page, 'LT')).toHaveCount(0);
    expect(market.sent).toContainEqual({ event: 'unsubscribe', data: { symbols: ['LT'] } });

    // Remove TCS with its chip.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Remove TCS' }).click();
    await expect(row(page, 'TCS')).toHaveCount(0);
    await expect(page.locator('[role="row"][data-symbol]')).toHaveCount(8);
    expect(market.sent).toContainEqual({ event: 'unsubscribe', data: { symbols: ['TCS'] } });

    expect(await renderCounts(page)).toEqual({});
  });

  test('the dropdown works from the keyboard', async ({ page }) => {
    await mockMarket(page);
    await page.goto('/');
    await waitForData(page);

    const trigger = page.getByRole('button', { name: 'Select Stocks' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const list = page.getByRole('listbox');
    await expect(list).toBeFocused();

    await page.keyboard.press('End'); // last option: WIPRO
    await page.keyboard.press(' ');
    await expect(page.getByRole('option', { name: /^WIPRO/ })).toHaveAttribute('aria-selected', 'true');
    await expect(row(page, 'WIPRO')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('clicking outside closes the dropdown', async ({ page }) => {
    await mockMarket(page);
    await page.goto('/');
    await waitForData(page);
    await page.getByRole('button', { name: 'Select Stocks' }).click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.locator('header').click();
    await expect(page.getByRole('listbox')).toBeHidden();
  });
});

test('after the connection drops it reconnects and resubscribes to the same stocks', async ({ page }) => {
  const market = await mockMarket(page);
  await page.goto('/');
  await waitForData(page);
  const opened = market.connections();
  market.sent.length = 0;

  await market.drop();
  await expect(page.locator('header [role="status"]')).not.toHaveText('Live');
  await expect.poll(() => market.connections(), { timeout: 10_000 }).toBe(opened + 1);
  await expect(page.locator('header [role="status"]')).toHaveText('Live');

  const resubscribed = market.sent.find((m) => m.event === 'subscribe');
  expect(resubscribed?.data?.symbols?.sort()).toEqual(DESIGN_ROWS.map((r) => r.s).sort());
});

test('longer symbols and bigger prices widen their columns instead of being cut off', async ({ page }) => {
  const market = await mockMarket(page);
  await page.goto('/');
  await waitForData(page);

  const clippedCells = () =>
    page
      .locator('[role="row"] > *')
      .evaluateAll((els) =>
        els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
      );
  const stickyLefts = () =>
    page.locator('[role="row"]').evaluateAll((rows) =>
      rows.map((r) =>
        [...r.children]
          .slice(0, 3)
          .map((c) => Math.round(c.getBoundingClientRect().left))
          .join(','),
      ),
    );
  const symbolColumnWidth = () =>
    page.getByRole('columnheader', { name: 'Symbol' }).evaluate((el) => el.getBoundingClientRect().width);

  expect(Math.abs((await symbolColumnWidth()) - 161)).toBeLessThanOrEqual(1); // reference width

  await page.getByRole('button', { name: 'Select Stocks' }).click();
  await page.getByRole('option', { name: /^ULTRACEMCO/ }).click();
  await page.keyboard.press('Escape');
  await expect(row(page, 'ULTRACEMCO')).toContainText('₹ 11,200.00');
  await expect.poll(clippedCells).toEqual([]);
  expect(await symbolColumnWidth()).toBeGreaterThan(161);
  expect(new Set(await stickyLefts()).size).toBe(1); // header and every row still line up

  // A price gaining a digit widens LTP on the spot.
  market.tick([{ ...market.latest('KOTAKBANK'), ltp: 120287.7 }]);
  await expect(row(page, 'KOTAKBANK')).toContainText('₹ 1,20,287.70');
  await expect.poll(clippedCells).toEqual([]);
  expect(new Set(await stickyLefts()).size).toBe(1);

  // Remove the long one again: Symbol goes back to the reference width.
  await page.getByRole('button', { name: 'Select Stocks' }).click();
  await page.getByRole('option', { name: /^ULTRACEMCO/ }).click();
  await page.keyboard.press('Escape');
  await expect(row(page, 'ULTRACEMCO')).toHaveCount(0);
  await expect.poll(async () => Math.abs((await symbolColumnWidth()) - 161)).toBeLessThanOrEqual(1);
});

test.describe('Refresh button', () => {
  test('pulls a fresh snapshot that repairs a missed update, and spins while doing it', async ({ page }) => {
    const market = await mockMarket(page);
    await page.goto('/');
    await waitForData(page);

    // The server's TCS price moves but the frame never reaches the page.
    market.changeSilently([{ ...market.latest('TCS'), ltp: 3501.25, chg: 2.17 }]);
    await page.waitForTimeout(200);
    await expect(row(page, 'TCS')).toContainText('₹ 3,467.80');

    const button = page.getByRole('button', { name: 'Refresh prices' });
    await button.click();
    await expect(button.locator('svg')).toHaveClass(/spin/); // visible feedback
    await expect(row(page, 'TCS')).toContainText('₹ 3,501.25');
    await expect(row(page, 'TCS')).toContainText('+2.17%');
    expect(market.sent.filter((m) => m.event === 'refresh')).toHaveLength(1);
    await expect(button.locator('svg')).not.toHaveClass(/spin/); // and stops again
  });

  test('when the link is down it reconnects at once instead of waiting for the retry timer', async ({
    page,
  }) => {
    const market = await mockMarket(page);
    await page.goto('/');
    await waitForData(page);
    const opened = market.connections();

    await market.drop();
    await expect(page.locator('header [role="status"]')).not.toHaveText('Live');
    await page.getByRole('button', { name: 'Refresh prices' }).click();
    await expect.poll(() => market.connections()).toBeGreaterThan(opened);
    await expect(page.locator('header [role="status"]')).toHaveText('Live');
  });
});

test.describe('Sorting (reference sort arrows)', () => {
  const symbolsOnScreen = (page: Page) => page.locator('[role="rowheader"]').allTextContents();
  const pickedOrder = DESIGN_ROWS.map((r) => r.s);

  test('LTP cycles highest-first, lowest-first, then back to the picking order', async ({ page }) => {
    await mockMarket(page);
    await page.goto('/');
    await waitForData(page);
    const ltpHeader = page.getByRole('columnheader', { name: 'LTP' });
    const byLtp = [...DESIGN_ROWS].sort((a, b) => b.ltp - a.ltp).map((r) => r.s);

    await ltpHeader.getByRole('button').click();
    await expect(ltpHeader).toHaveAttribute('aria-sort', 'descending');
    expect(await symbolsOnScreen(page)).toEqual(byLtp);

    await ltpHeader.getByRole('button').click();
    await expect(ltpHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(await symbolsOnScreen(page)).toEqual([...byLtp].reverse());

    await ltpHeader.getByRole('button').click();
    await expect(ltpHeader).toHaveAttribute('aria-sort', 'none');
    expect(await symbolsOnScreen(page)).toEqual(pickedOrder);
  });

  test('Symbol sorts A to Z and Z to A; Change % sorts gainers first', async ({ page }) => {
    await mockMarket(page);
    await page.goto('/');
    await waitForData(page);

    await page.getByRole('button', { name: 'Symbol' }).click();
    expect(await symbolsOnScreen(page)).toEqual([...pickedOrder].sort());
    await page.getByRole('button', { name: 'Symbol' }).click();
    expect(await symbolsOnScreen(page)).toEqual([...pickedOrder].sort().reverse());

    await page.getByRole('button', { name: 'Change %' }).click();
    expect(await symbolsOnScreen(page)).toEqual(
      [...DESIGN_ROWS].sort((a, b) => b.chg - a.chg).map((r) => r.s),
    );
    await expect(page.getByRole('columnheader', { name: 'Symbol' })).toHaveAttribute('aria-sort', 'none');
  });

  test('a live sort re-orders rows as prices move, without re-rendering any untouched cell', async ({
    page,
  }) => {
    const market = await mockMarket(page);
    await page.goto('/');
    await waitForData(page);
    await page.getByRole('button', { name: 'Change %' }).click();
    expect((await symbolsOnScreen(page))[0]).toBe('RELIANCE'); // +2.35% leads
    await resetRenderCounts(page);

    // KOTAKBANK jumps from -1.12% to +3.10%: it must move to the top.
    market.tick([{ ...market.latest('KOTAKBANK'), chg: 3.1 }]);
    await expect.poll(async () => (await symbolsOnScreen(page))[0]).toBe('KOTAKBANK');
    expect(await renderCounts(page)).toEqual({ 'KOTAKBANK:changePct': 1 });

    // A new stock waits at the bottom until its first price arrives, then
    // moves into place: -0.15% (ICICIBANK), then WIPRO's -0.19%.
    await page.getByRole('button', { name: 'Select Stocks' }).click();
    await page.getByRole('option', { name: /^WIPRO/ }).click();
    await page.keyboard.press('Escape');
    await expect
      .poll(async () => {
        const order = await symbolsOnScreen(page);
        return order.indexOf('WIPRO') - order.indexOf('ICICIBANK');
      })
      .toBe(1);
  });

  test('sorting is keyboard accessible', async ({ page }) => {
    await mockMarket(page);
    await page.goto('/');
    await waitForData(page);
    await page.getByRole('button', { name: 'LTP' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('columnheader', { name: 'LTP' })).toHaveAttribute('aria-sort', 'descending');
  });
});
