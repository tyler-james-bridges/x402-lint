import { defineConfig } from '@playwright/test';

const workers = parseInt(process.env.WORKERS || '1', 10);
const headed = process.env.HEADLESS !== 'true';
const slow = parseInt(process.env.SLOW_MO || '200', 10);

export default defineConfig({
  testDir: '.',
  testMatch: 'demo.spec.ts',
  timeout: 60000,
  fullyParallel: workers > 1,
  use: {
    headless: !headed,
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      slowMo: slow,
    },
  },
  workers,
});
