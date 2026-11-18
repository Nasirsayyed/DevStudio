import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Replaces the content of the Monaco editor with the given accessible label. */
async function setEditor(page: Page, label: string, text: string) {
  const editor = page.getByRole('region', { name: label }).locator('.monaco-editor').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press('ControlOrMeta+v');
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('JSON Studio (real Monaco, production CSP)', () => {
  test('formats JSON and pinpoints syntax errors', async ({ page }) => {
    await page.goto('/json/formatter');
    await setEditor(page, 'Input', '{"a":[1,2],"b":{"c":true}}');
    const output = page.getByRole('region', { name: 'Output' });
    await expect(output.locator('.view-lines')).toContainText('"c": true');
    await expect(page.getByText('✓ Valid JSON')).toBeVisible();

    await setEditor(page, 'Input', '{\n  "a": 1,\n}');
    const goTo = page.getByRole('button', { name: /Go to error/ });
    await expect(goTo).toContainText("Ln 2, Col 9: Trailing comma before '}'");
    // Monaco renders an error squiggle for the marker
    await expect(
      page.getByRole('region', { name: 'Input' }).locator('.squiggly-error'),
    ).toHaveCount(1);
  });

  test('keeps the document when switching tools and restores it after reload', async ({ page }) => {
    await page.goto('/json/formatter');
    await page.getByRole('button', { name: 'Load sample' }).click();
    await page
      .getByRole('navigation', { name: 'JSON Studio tools' })
      .getByRole('link', { name: 'JSONPath Tester' })
      .click();
    await page
      .getByRole('textbox', { name: 'JSONPath expression' })
      .fill('$.items[?(@.unit_price > 1000)].name');
    // Filter expressions run in jsonpath-plus' safe evaluator — no eval under the CSP.
    await expect(page.getByRole('grid', { name: 'JSONPath matches' })).toContainText(
      '"Mechanical keyboard"',
    );
    await page.waitForTimeout(1200); // draft save is debounced
    await page.reload();
    await expect(page.getByRole('grid', { name: 'JSONPath matches' })).toContainText(
      '"Mechanical keyboard"',
    );
  });

  test('compares documents structurally and in a text diff', async ({ page }) => {
    await page.goto('/json/compare');
    await page
      .getByRole('region', { name: 'Left (original)' })
      .getByRole('button', { name: 'Load sample' })
      .click();
    await page
      .getByRole('region', { name: 'Right (changed)' })
      .getByRole('button', { name: 'Load sample' })
      .click();
    await expect(page.getByLabel('Difference summary')).toContainText('Type differs: 1');
    await page.getByRole('tab', { name: 'Text diff' }).click();
    await expect(page.locator('.monaco-diff-editor')).toBeVisible();
  });

  test('processes a large file in a Web Worker', async ({ page }) => {
    await page.goto('/json/minifier');
    const big = JSON.stringify(
      Array.from({ length: 60_000 }, (_, i) => ({ id: i, name: `item ${i}`, tags: ['a', 'b'] })),
      null,
      2,
    );
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'big.json', mimeType: 'application/json', buffer: Buffer.from(big) });
    await expect(page.getByText('Large input')).toBeVisible();
    await page.getByRole('button', { name: 'Run' }).first().click();
    await expect(page.getByRole('region', { name: 'Output' }).getByText(/^−\d/)).toBeVisible({
      timeout: 20_000,
    });
    const workers = page.workers().map((w) => w.url());
    expect(workers.some((url) => /devstudio-json|json\.worker/.test(url))).toBe(true);
  });

  test('validates against a JSON Schema', async ({ page }) => {
    await page.goto('/json/schema-validator');
    await page
      .getByRole('region', { name: 'Data' })
      .getByRole('button', { name: 'Load sample' })
      .click();
    await page
      .getByRole('region', { name: 'JSON Schema' })
      .getByRole('button', { name: 'Load sample' })
      .click();
    await expect(page.getByText('The data is valid against the schema.')).toBeVisible();
  });
});
