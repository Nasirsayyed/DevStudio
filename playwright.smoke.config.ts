import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests against a deployed URL:
 *   SMOKE_URL=https://devstudio.example.com npx playwright test -c playwright.smoke.config.ts
 * Protected Vercel previews: set VERCEL_AUTOMATION_BYPASS_SECRET (sent as a header, never logged).
 */
const baseURL = process.env.SMOKE_URL;
if (!baseURL) throw new Error('Set SMOKE_URL to the deployment to test.');

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: './e2e/smoke',
  retries: 2,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'off',
    extraHTTPHeaders: bypass
      ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
      : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
