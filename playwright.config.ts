import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for SmokeScan E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
// Skip local webServer when running production tests only
const isProductionOnly = process.argv.includes('--project') &&
  process.argv[process.argv.indexOf('--project') + 1] === 'production';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'production',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://smokescan.lando555.workers.dev',
      },
      testMatch: /real-chat/,
      timeout: 600000,
    },
  ],
  webServer: isProductionOnly ? undefined : {
    command: 'npm run dev -- --host',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
