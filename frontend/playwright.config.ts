import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end checks, one per requirement in the problem statement, in all
 * three browser engines.
 *
 * Chromium runs on the locally installed Microsoft Edge. Set PW_CHANNEL=chrome,
 * or PW_CHANNEL= for Playwright's bundled Chromium. WebKit (Safari) and Firefox
 * need `npx playwright install webkit firefox` once.
 */
const channel = process.env.PW_CHANNEL ?? 'msedge';
const API_PORT = 3100;
const WEB_PORT = 5174;

const desktopViewport = { width: 1536, height: 1024 };
const phoneViewport = { width: 375, height: 812 };
const chromium = {
  channel: channel || undefined,
  // Headless Chromium hides scrollbars by default; the reference shows one.
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
};

export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  timeout: 30_000,
  workers: 3,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    // Chromium (Edge): everything, including the live-server suite and the pixel diff.
    {
      name: 'desktop',
      testMatch: /desktop\.spec\.ts|live\.spec\.ts/,
      use: { ...chromium, viewport: desktopViewport },
    },
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'], ...chromium, viewport: phoneViewport },
    },
    // Safari's engine, on desktop and on an iPhone.
    {
      name: 'desktop-webkit',
      testMatch: /desktop\.spec\.ts/,
      use: { ...devices['Desktop Safari'], viewport: desktopViewport },
    },
    {
      name: 'mobile-webkit',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['iPhone 13'], viewport: phoneViewport },
    },
    // Firefox (it has no mobile emulation in Playwright).
    {
      name: 'desktop-firefox',
      testMatch: /desktop\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], viewport: desktopViewport },
    },
  ],
  webServer: [
    {
      command: 'npm run build && npm start',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { PORT: String(API_PORT), TICK_INTERVAL_MS: '200', UPDATE_RATIO: '1' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
