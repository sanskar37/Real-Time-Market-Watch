import { defineConfig } from '@playwright/test';

/**
 * The browser half of the scalability demo: `npm run demo:browsers`.
 *
 * Starts its own API (500 ms ticks, the app's normal setting) and page, then
 * runs e2e/scale.demo.ts, which opens 50 real browser sessions of the actual
 * UI at once. Kept out of the normal e2e run because it is heavy.
 */
const API_PORT = 3200;
const WEB_PORT = 5175;

export default defineConfig({
  testDir: './e2e',
  testMatch: /scale\.demo\.ts/,
  timeout: 300_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: process.env.PW_CHANNEL ?? 'msedge',
    viewport: { width: 1280, height: 800 },
  },
  webServer: [
    {
      command: 'npm run build && npm start',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

export const SCALE_API = `http://localhost:${API_PORT}`;
