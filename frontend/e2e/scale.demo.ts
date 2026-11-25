import { expect, test, type Page } from '@playwright/test';
import { SCALE_API } from '../playwright.scale.config';
import { row, waitForData } from './support';

/**
 * 50 real browser sessions of the actual UI, connected at once, each with its
 * own stock selection. Every session must show exactly its own stocks, receive
 * only its own stocks over the WebSocket, and keep updating live.
 *
 * Run with `npm run demo:browsers`. BROWSER_USERS changes the count.
 */
const USERS = Number(process.env.BROWSER_USERS ?? 50);
const BATCH = 10; // sessions opened at a time
const WATCH_MS = 6_000;

interface Session {
  id: number;
  page: Page;
  expected: string[];
  /** Symbols in tick frames received after the session settled on its selection. */
  received: Set<string>;
  settled: boolean;
}

interface Metrics {
  connections: number;
  subscriptions: number;
  window: { framesPerSec: number; cpuPercent: number; eventLoopDelayMs: { p99: number } } | null;
  memoryMb: { rss: number };
}

async function toggle(page: Page, symbol: string) {
  await page.getByRole('button', { name: 'Select Stocks' }).click();
  await page.getByRole('option', { name: new RegExp(`^${symbol}`) }).click();
  await page.keyboard.press('Escape');
}

const ltpTexts = (page: Page) => page.locator('[role="row"][data-symbol] > :nth-child(3)').allTextContents();

test(`${USERS} real browser users watch different stocks at the same time`, async ({ browser }) => {
  const catalog = (await (await fetch(`${SCALE_API}/api/stocks`)).json()) as {
    stocks: { symbol: string }[];
    defaults: string[];
  };
  const all = catalog.stocks.map((s) => s.symbol);
  const defaults = catalog.defaults;

  // Every user makes a different change from the defaults, so no two end up
  // with the same selection: users 0-29 toggle one stock each, the rest toggle
  // a distinct neighbouring pair (stocks k and k+1).
  const plans = Array.from({ length: USERS }, (_, i) => {
    const n = all.length;
    const toggles = i < n ? [all[i]!] : [all[(i - n) % n]!, all[(i - n + 1) % n]!];
    const expected = new Set(defaults);
    for (const s of toggles) {
      if (expected.has(s)) expected.delete(s);
      else expected.add(s);
    }
    return { toggles, expected: [...expected] };
  });
  const distinct = new Set(plans.map((p) => [...p.expected].sort().join(','))).size;

  // Open the sessions in batches, each in its own browser context (own storage, own socket).
  const sessions: Session[] = [];
  for (let start = 0; start < USERS; start += BATCH) {
    const batch = await Promise.all(
      plans.slice(start, start + BATCH).map(async (plan, offset) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const session: Session = {
          id: start + offset,
          page,
          expected: plan.expected,
          received: new Set(),
          settled: false,
        };
        page.on('websocket', (ws) =>
          ws.on('framereceived', ({ payload }) => {
            if (!session.settled) return;
            const frame = JSON.parse(String(payload)) as { t: string; q?: { s: string }[] };
            if (frame.t === 'tick') frame.q?.forEach((q) => session.received.add(q.s));
          }),
        );
        await page.goto('/');
        await waitForData(page);
        for (const symbol of plan.toggles) await toggle(page, symbol);
        return session;
      }),
    );
    sessions.push(...batch);
    console.log(`  ${sessions.length}/${USERS} browser sessions open`);
  }

  // Everyone is connected with their own selection. Now watch them all stream at once.
  await sessions[0]!.page.waitForTimeout(1_000); // in-flight frames from the toggles land
  const before = await Promise.all(sessions.map((s) => ltpTexts(s.page)));
  sessions.forEach((s) => (s.settled = true));
  await sessions[0]!.page.waitForTimeout(WATCH_MS);

  const metrics = (await (await fetch(`${SCALE_API}/api/metrics`)).json()) as Metrics;
  const after = await Promise.all(sessions.map((s) => ltpTexts(s.page)));

  let rowsWrong = 0;
  let foreign = 0;
  let notLive = 0;
  for (const [i, s] of sessions.entries()) {
    const onScreen = (await s.page.locator('[role="rowheader"]').allTextContents()).sort();
    if (onScreen.join() !== [...s.expected].sort().join()) rowsWrong += 1;
    if ([...s.received].some((symbol) => !s.expected.includes(symbol))) foreign += 1;
    if (after[i]!.every((v, j) => v === before[i]![j])) notLive += 1;
  }

  console.log(`
  ${USERS} browser sessions, ${distinct} different selections
    rows match the user's own selection : ${USERS - rowsWrong}/${USERS}
    received only their own stocks      : ${USERS - foreign}/${USERS}
    prices updating on screen           : ${USERS - notLive}/${USERS}
    server: ${metrics.connections} connections, ${metrics.subscriptions} subscriptions${
      metrics.window
        ? `, ${metrics.window.framesPerSec} frames/s, CPU ${metrics.window.cpuPercent}%,` +
          ` event-loop delay p99 ${metrics.window.eventLoopDelayMs.p99} ms`
        : ''
    }, memory ${metrics.memoryMb.rss} MB
  `);
  await sessions[USERS - 1]!.page.screenshot({ path: 'test-results/screenshots/scale-browser-50.png' });

  expect(distinct).toBe(Math.min(USERS, 2 * all.length));
  expect(metrics.connections).toBeGreaterThanOrEqual(USERS);
  expect(metrics.subscriptions).toBe(sessions.reduce((n, s) => n + s.expected.length, 0));
  expect(rowsWrong).toBe(0);
  expect(foreign).toBe(0);
  expect(notLive).toBe(0);

  // Spot-check one session's table against its plan.
  const sample = sessions[USERS - 1]!;
  for (const symbol of sample.expected) await expect(row(sample.page, symbol)).toBeVisible();
});
