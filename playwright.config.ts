import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'demo.spec.ts',
  timeout: 60000,
  use: {
    headless: false,
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      slowMo: 200,
    },
  },
  workers: 1,
});
