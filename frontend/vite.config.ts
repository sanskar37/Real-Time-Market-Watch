/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API = process.env.VITE_API_TARGET ?? 'http://localhost:3000';

// One origin for the browser: Vite forwards REST and WebSocket traffic to the API.
const proxy = {
  '/api': { target: API, changeOrigin: true },
  '/ws': { target: API, ws: true, changeOrigin: true },
};

// Hostnames allowed besides localhost, e.g. a Cloudflare quick tunnel for sharing a demo.
const allowedHosts = ['.trycloudflare.com', '.ngrok-free.app'];

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy, allowedHosts },
  preview: { port: 4173, proxy, allowedHosts },
  build: { target: 'es2022', sourcemap: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
