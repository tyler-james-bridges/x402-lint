import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:8402';

const LINT_ENDPOINTS = [
  'https://api.ordiscan.com/v1/inscription/0',
  'https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools',
  'https://x402.bankr.bot/0xf31f59e7b8b58555f7871f71973a394c8f1bffe5/quantum-premium',
  'https://x402.bankr.bot/0xe3cee257fac729a56a786d48cf4d29be0d8e732f/rickroll',
  'https://x402.bankr.bot/0xa046e9c133afd37fe2278fc5f0defdfc9cf2ba5f/younanix-memory',
  'https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/lint',
];

const HEALTH_ENDPOINTS = [
  { url: 'https://api.ordiscan.com/v1/inscription/0', expected: 'x402' },
  { url: 'https://x402.bankr.bot/0xe3cee257fac729a56a786d48cf4d29be0d8e732f/rickroll', expected: 'x402' },
  { url: 'https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools', expected: 'x402' },
  { url: 'https://google.com', expected: 'alive' },
  { url: 'https://api.github.com', expected: 'alive' },
  { url: 'https://this-does-not-exist-at-all.fake', expected: 'dead' },
];

test.describe('lint demo', () => {
  for (const endpoint of LINT_ENDPOINTS) {
    test(`lint: ${endpoint.split('/').slice(-2).join('/')}`, async ({ page }) => {
      await page.goto(BASE);
      await page.waitForTimeout(500);

      // make sure lint mode is active
      await page.click('#mode-lint');
      await page.waitForTimeout(300);

      // type the url
      const input = page.locator('#url-input');
      await input.fill('');
      await input.type(endpoint, { delay: 15 });
      await page.waitForTimeout(300);

      // click lint
      await page.click('#run-btn');

      // wait for result
      await page.waitForSelector('.grade-circle', { timeout: 30000 });
      await page.waitForTimeout(2000);

      // grab the grade
      const grade = await page.textContent('.grade-circle');
      console.log(`  ${endpoint} => ${grade}`);
    });
  }
});

test.describe('health demo', () => {
  for (const { url, expected } of HEALTH_ENDPOINTS) {
    test(`health: ${url.replace('https://', '').slice(0, 40)}`, async ({ page }) => {
      await page.goto(BASE);
      await page.waitForTimeout(500);

      // switch to health mode
      await page.click('#mode-health');
      await page.waitForTimeout(300);

      // type the url
      const input = page.locator('#url-input');
      await input.fill('');
      await input.type(url, { delay: 15 });
      await page.waitForTimeout(300);

      // click health
      await page.click('#run-btn');

      // wait for result
      await page.waitForSelector('.grade-circle', { timeout: 30000 });
      await page.waitForTimeout(2000);

      const status = await page.textContent('.grade-circle');
      console.log(`  ${url} => ${status} (expected: ${expected})`);
    });
  }
});
