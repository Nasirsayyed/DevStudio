import { expect, test } from './fixtures';

const API = 'https://api.example.test';

test.describe('API Studio (real fetch and CORS, production CSP)', () => {
  test('sends a request with environment variables, shows the response and records history', async ({
    page,
  }) => {
    await page.route(`${API}/**`, (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'X-Trace',
          'X-Trace': 'abc',
        },
        body: JSON.stringify({ id: 7, url: route.request().url() }),
      }),
    );
    await page.goto('/api/environments');
    const form = page.getByRole('form', { name: /^Environment / });
    await form.getByRole('textbox', { name: 'Variables value 1' }).fill(API);
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/^Saved "/)).toBeVisible();
    await form.getByRole('button', { name: 'Use this environment' }).click();

    await page.goto('/api/requests');
    await page.getByRole('textbox', { name: 'URL' }).fill('{{baseUrl}}/items');
    await page.getByRole('tab', { name: 'Params' }).click();
    await page.getByRole('textbox', { name: 'Query parameters key 1' }).fill('page');
    await page.getByRole('textbox', { name: 'Query parameters value 1' }).fill('2');
    await page.getByRole('textbox', { name: 'URL' }).press('ControlOrMeta+Enter');

    const response = page.getByRole('region', { name: 'Response' });
    await expect(response.getByLabel('Status')).toHaveText('201 Created');
    await expect(response.locator('.view-lines')).toContainText('"id": 7');
    await expect(response.locator('.view-lines')).toContainText('page=2');
    await response.getByRole('tab', { name: /Headers/ }).click();
    await expect(response.getByRole('table', { name: 'Response headers' })).toContainText(
      'x-trace',
    );

    await page.goto('/api/history');
    await expect(page.getByRole('list', { name: 'History' }).getByRole('button')).toHaveCount(1);
    await expect(page.getByLabel('Request line')).toContainText(`GET ${API}/items?page=2`);
  });

  test('a server without CORS headers is reported, not bypassed', async ({ page, baseURL }) => {
    // A real cross-origin request (localhost → 127.0.0.1): the preview server sends no CORS
    // headers, so the browser itself blocks the response. (Routed responses would skip CORS.)
    const other = (baseURL ?? '').replace('localhost', '127.0.0.1');
    await page.goto('/api/requests');
    await page.getByRole('textbox', { name: 'URL' }).fill(`${other}/index.html`);
    await page.getByRole('button', { name: 'Send' }).click();
    const alert = page.getByRole('region', { name: 'Response' }).getByRole('alert');
    await expect(alert).toContainText('Access-Control-Allow-Origin');
    await expect(alert).toContainText('does not bypass CORS');
  });

  test('HTML responses preview in a sandbox and requests can be saved', async ({ page }) => {
    await page.route(`${API}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '<h1>Hello preview</h1><script>window.parent.document.title = "pwned"</script>',
      }),
    );
    await page.goto('/api/requests');
    await page.getByRole('textbox', { name: 'URL' }).fill(`${API}/page`);
    await page.getByRole('button', { name: 'Send' }).click();
    const frame = page.frameLocator('iframe[title="Response preview"]');
    await expect(frame.getByRole('heading', { name: 'Hello preview' })).toBeVisible();
    expect(await page.title()).not.toBe('pwned');

    await page.keyboard.press('ControlOrMeta+s');
    const dialog = page.getByRole('dialog', { name: 'Save request' });
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Landing page');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved "Landing page"')).toBeVisible();
    await page.reload();
    await expect(
      page
        .getByRole('navigation', { name: 'Collections' })
        .getByRole('button', { name: 'GET Landing page' }),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'URL' })).toHaveValue(`${API}/page`);
  });

  test('runs a collection with chained values and compares responses', async ({ page }) => {
    await page.route(`${API}/**`, (route) => {
      const url = route.request().url();
      const auth = route.request().headers().authorization;
      const body = url.endsWith('/login')
        ? { token: 'tok-1' }
        : auth === 'Bearer tok-1'
          ? { name: 'Ada', role: 'admin' }
          : { error: 'unauthorized' };
      return route.fulfill({
        status: url.endsWith('/login') || auth === 'Bearer tok-1' ? 200 : 401,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body),
      });
    });
    await page.goto('/api/requests');
    await page.getByRole('button', { name: 'Import collection' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import collection' });
    await dialog.getByLabel('Choose file').setInputFiles({
      name: 'shop.postman_collection.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          info: {
            name: 'Shop',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            { name: 'Login', request: { method: 'POST', url: `${API}/login` } },
            {
              name: 'Profile',
              request: {
                method: 'GET',
                url: `${API}/me`,
                auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] },
              },
            },
          ],
        }),
      ),
    });
    await expect(dialog.getByLabel('Import preview')).toContainText('2 requests');
    await dialog.getByRole('button', { name: 'Import' }).click();

    // Add an extraction to Login, then run the collection.
    await page.getByRole('button', { name: 'POST Login' }).click();
    await page.getByRole('tab', { name: 'Tests' }).click();
    await page.getByRole('button', { name: 'Add extraction' }).click();
    await page.getByRole('textbox', { name: 'Extraction 1 variable' }).fill('token');
    await page.getByRole('textbox', { name: 'Extraction 1 path' }).fill('$.token');
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByText('Saved "Login"')).toBeVisible();

    await page.goto('/api/runner');
    await page.getByRole('button', { name: 'Run (2)' }).click();
    const results = page.getByRole('region', { name: 'Run results' });
    await expect(results).toContainText('2 passed · 0 failed · 2/2');

    // Two different responses from the builder, compared with the real Monaco diff editor.
    await page.goto('/api/requests');
    await page.getByRole('button', { name: 'GET Profile' }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByRole('region', { name: 'Response' }).getByLabel('Status')).toHaveText(
      /401/,
    );
    await page.getByRole('button', { name: 'POST Login' }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByRole('region', { name: 'Response' }).getByLabel('Status')).toHaveText(
      /200/,
    );
    await page.goto('/api/history');
    await page.getByRole('button', { name: 'Compare with…' }).click();
    await page.getByRole('combobox', { name: 'Right response' }).click();
    await page.getByRole('option', { name: /^401 GET/ }).click();
    await expect(page.getByRole('status', { name: 'Comparison summary' })).toContainText(
      'Bodies differ',
    );
    await expect(page.locator('.monaco-diff-editor')).toBeVisible();
  });

  test('the OAuth callback page works in the production build', async ({ page }) => {
    await page.goto('/oauth/callback?code=abc&state=xyz');
    await expect(page.getByRole('heading', { name: 'Sign-in finished' })).toBeVisible();
    await expect(page).toHaveURL(/\/oauth\/callback$/);
  });
});
