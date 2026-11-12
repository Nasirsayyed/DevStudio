import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Replaces the content of the Monaco editor in the panel with the given name. */
async function setEditor(page: Page, panel: string, text: string) {
  const editor = page.getByRole('region', { name: panel }).locator('.monaco-editor').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press('ControlOrMeta+v');
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('Text Tools (real Monaco, production CSP)', () => {
  test('Markdown preview: sanitized, sandboxed, no scripts and no external requests', async ({
    page,
  }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:'))
        external.push(r.url());
    });
    page.on('dialog', (d) => {
      external.push(`dialog: ${d.message()}`);
      void d.dismiss();
    });
    await page.goto('/text/markdown-preview');
    await setEditor(
      page,
      'Markdown',
      '# Hello\n\n<img src="https://tracker.example/p.gif" onerror="alert(1)">\n\n<script>alert(2)</script>\n\n| a | b |\n|---|---|\n| 1 | 2 |\n',
    );
    const frame = page.frameLocator('iframe[title="Markdown preview"]');
    await expect(frame.getByRole('heading', { level: 1, name: 'Hello' })).toBeVisible();
    await expect(frame.locator('table td').first()).toHaveText('1');
    await expect(page.getByText(/1 external resource was blocked/)).toBeVisible();
    expect(await frame.locator('script').count()).toBe(0);
    expect(external).toEqual([]);
  });

  test('HTML preview renders styles but never runs scripts', async ({ page }) => {
    const events: string[] = [];
    page.on('dialog', (d) => {
      events.push(d.message());
      void d.dismiss();
    });
    page.on('request', (r) => {
      if (r.url().includes('tracker.example')) events.push(r.url());
    });
    await page.goto('/text/html-preview');
    await page.getByRole('button', { name: 'Load sample' }).click();
    const frame = page.frameLocator('iframe[title="HTML preview"]');
    await expect(frame.getByRole('heading', { name: 'Hello from HTML Preview' })).toBeVisible();
    const color = await frame.locator('.card').evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(255, 255, 255)');
    await frame.getByText('Event handlers and scripts are removed.').click();
    await page.getByRole('combobox', { name: 'Viewport' }).click();
    await page.getByRole('option', { name: 'Phone (390)' }).click();
    await expect(page.locator('iframe[title="HTML preview"]')).toHaveCSS('width', '390px');
    expect(events).toEqual([]);
  });

  test('find & replace stops a catastrophic regular expression and stays responsive', async ({
    page,
  }) => {
    await page.goto('/text/find-replace');
    await setEditor(page, 'Text', `${'a'.repeat(40)}!`);
    await page.getByRole('switch', { name: 'Regular expression' }).click();
    await page.getByRole('textbox', { name: 'Find (regular expression)' }).fill('^(a+)+$');
    // While the worker is busy, the page keeps responding to input.
    await page.getByRole('textbox', { name: 'Replace with' }).fill('still typing');
    await expect(page.getByRole('textbox', { name: 'Replace with' })).toHaveValue('still typing');
    await expect(page.getByText(/took longer than 5 s and was stopped/)).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('textbox', { name: 'Find (regular expression)' }).fill('a{3}');
    await expect(page.getByText('13 matches')).toBeVisible();
  });

  test('text diff of large inputs runs in the background and code diff uses Monaco', async ({
    page,
  }) => {
    const lines = Array.from({ length: 20_000 }, (_, i) => `row ${String(i)} value`).join('\n');
    await page.goto('/text/text-diff');
    await setEditor(page, 'Original', lines);
    await setEditor(page, 'Modified', lines.replace('row 10000 value', 'row 10000 VALUE'));
    const table = page.getByRole('table', { name: 'Differences' });
    await expect(table.getByText('VALUE', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('~1')).toBeVisible();

    await page.goto('/text/code-diff');
    await page
      .getByRole('region', { name: 'Original code' })
      .getByRole('button', { name: 'Load sample' })
      .click();
    await page
      .getByRole('region', { name: 'Modified code' })
      .getByRole('button', { name: 'Load sample' })
      .click();
    await expect(page.locator('.monaco-diff-editor')).toBeVisible();
    await expect(page.locator('.monaco-diff-editor .line-insert').first()).toBeVisible();
  });

  test('XML and YAML formatters with syntax highlighting', async ({ page }) => {
    await page.goto('/text/xml-formatter');
    await page.getByRole('button', { name: 'Load sample' }).click();
    const out = page.getByRole('region', { name: 'Output' });
    await expect(out.locator('.view-lines')).toContainText('<book id="bk101" lang="en">');

    await page.goto('/text/yaml-formatter');
    await page.getByRole('button', { name: 'Load sample' }).click();
    await page.getByRole('combobox', { name: 'Mode' }).click();
    await page.getByRole('option', { name: 'YAML → JSON' }).click();
    await expect(out.locator('.view-lines')).toContainText('"timeout": 30');
  });
});
