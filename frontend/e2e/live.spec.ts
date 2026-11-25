import { expect, test, type Page } from '@playwright/test';
import { row, waitForData } from './support';

/**
 * These run against the real NestJS service (started by playwright.config.ts
 * with a 200 ms tick), end to end over a real WebSocket.
 */

/** Records the symbols in every tick frame the page receives. */
function recordTicks(page: Page) {
  const ticks: string[][] = [];
  page.on('websocket', (ws) => {
    ws.on('framereceived', ({ payload }) => {
      const frame = JSON.parse(String(payload)) as { t: string; q?: { s: string }[] };
      if (frame.t === 'tick') ticks.push((frame.q ?? []).map((q) => q.s));
    });
  });
  return ticks;
}

test('prices stream in continuously over the WebSocket (doc 2A)', async ({ page }) => {
  await page.goto('/');
  await waitForData(page);
  await expect(page.locator('header [role="status"]')).toHaveText('Live');

  const ltps = () => page.locator('[role="row"][data-symbol] [role="cell"]:nth-child(3)').allTextContents();
  const first = await ltps();
  await expect.poll(async () => (await ltps()).filter((v, i) => v !== first[i]).length).toBeGreaterThan(3);
});

test('the refresh button gets a full snapshot from the real server', async ({ page }) => {
  const snapshots: string[][] = [];
  page.on('websocket', (ws) =>
    ws.on('framereceived', ({ payload }) => {
      const frame = JSON.parse(String(payload)) as { t: string; q?: { s: string }[] };
      if (frame.t === 'snapshot') snapshots.push((frame.q ?? []).map((q) => q.s));
    }),
  );
  await page.goto('/');
  await waitForData(page);
  const before = snapshots.length;

  await page.getByRole('button', { name: 'Refresh prices' }).click();
  await expect.poll(() => snapshots.length).toBe(before + 1);
  expect(snapshots.at(-1)!.sort()).toEqual([
    'BHARTIARTL',
    'HDFCBANK',
    'ICICIBANK',
    'INFY',
    'ITC',
    'KOTAKBANK',
    'RELIANCE',
    'SBIN',
    'TCS',
  ]);
});

test('two users watch different stocks without affecting each other (doc 2B)', async ({ browser }) => {
  const alice = await browser.newPage();
  const bob = await browser.newPage();
  const aliceTicks = recordTicks(alice);
  const bobTicks = recordTicks(bob);

  await alice.goto('/');
  await bob.goto('/');
  await waitForData(alice);
  await waitForData(bob);

  // Bob drops RELIANCE and adds WIPRO; Alice changes nothing.
  await bob.getByRole('button', { name: 'Remove RELIANCE' }).click();
  await bob.getByRole('button', { name: 'Select Stocks' }).click();
  await bob.getByRole('option', { name: /^WIPRO/ }).click();
  await expect(row(bob, 'WIPRO')).toBeVisible();
  await expect(row(bob, 'RELIANCE')).toHaveCount(0);
  await bob.waitForTimeout(400); // let in-flight frames land

  const bobFrom = bobTicks.length;
  const aliceFrom = aliceTicks.length;
  await bob.waitForTimeout(1500);

  const bobSymbols = new Set(bobTicks.slice(bobFrom).flat());
  const aliceSymbols = new Set(aliceTicks.slice(aliceFrom).flat());

  expect(bobSymbols.has('RELIANCE')).toBe(false);
  expect(bobSymbols.has('WIPRO')).toBe(true);
  expect(aliceSymbols.has('RELIANCE')).toBe(true);
  expect(aliceSymbols.has('WIPRO')).toBe(false);
  await expect(row(alice, 'RELIANCE')).toBeVisible();

  await alice.close();
  await bob.close();
});
