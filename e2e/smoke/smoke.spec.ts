import { CACHE_HEADERS, SECURITY_HEADERS } from '../../config/security-headers';
import { expect, test } from '../fixtures';

/**
 * Post-deployment smoke tests. They run in the normal e2e suite (against `vite preview`) and,
 * through playwright.smoke.config.ts, against a deployed URL (SMOKE_URL).
 */
test.describe('Smoke: deployment', () => {
  test('serves the security headers and revalidates HTML', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
    const headers = res.headers();
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      expect(headers[name.toLowerCase()], name).toBe(value);
    expect(headers['cache-control']).toBe(CACHE_HEADERS.html);
    expect(headers['content-type']).toMatch(/text\/html/);
  });

  test('serves hashed assets as immutable JavaScript', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const script = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
    expect(script, 'index.html references a hashed script').toBeTruthy();
    const res = await request.get(script ?? '');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/javascript/);
    expect(res.headers()['cache-control']).toBe(CACHE_HEADERS.assets);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('deep links, the OAuth callback and unknown routes are served by the SPA', async ({
    page,
    request,
  }) => {
    for (const path of ['/json/formatter', '/api/requests', '/oauth/callback', '/no/such/page']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['cache-control'], path).toBe(CACHE_HEADERS.html);
    }
    await page.goto('/json/formatter');
    await expect(page.getByRole('heading', { level: 1, name: 'JSON Formatter' })).toBeVisible();
    await page.goto('/no/such/page');
    await expect(page.getByText(/not found/i).first()).toBeVisible();
  });

  test('the app boots and runs code in workers and WebAssembly under the CSP', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/sql/playground');
    await page.getByRole('button', { name: 'Load sample' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('region', { name: 'Result 1' })).toContainText('3 rows', {
      timeout: 20_000,
    });
  });
});
