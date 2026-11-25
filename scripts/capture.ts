/**
 * Captures the running app at the reference size (1536 x 1024) with real
 * scrollbars, for side-by-side comparison with reference/market-watch.png.
 *
 *   node scripts/capture.ts [url] [out.png] [width] [height]
 *
 * Start the API with SIM_AUTOSTART=false first so the numbers match the design.
 */
import { chromium } from '@playwright/test';

const [
  url = 'http://localhost:5173',
  out = 'docs/screenshots/desktop-1536.png',
  width = '1536',
  height = '1024',
] = process.argv.slice(2);

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? 'msedge',
  ignoreDefaultArgs: ['--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
await page.goto(url);
await page.waitForSelector('[role="row"][data-symbol] [role="cell"]:not(:empty)');
await page.waitForFunction(() => !document.body.innerText.includes('—'));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);
