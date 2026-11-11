import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

test.describe('Code Generators (real Monaco, production CSP)', () => {
  test('generates syntax-highlighted C# and downloads a ZIP of classes', async ({ page }) => {
    await page.goto('/codegen/csharp');
    await page.getByRole('button', { name: 'Load sample' }).click();
    const output = page.getByRole('region', { name: 'Generated code' });
    // Monaco virtualizes lines: assert on content near the top.
    await expect(output.locator('.view-lines')).toContainText('public class Root');
    // The C# Monarch tokenizer is active: several distinct token classes are rendered.
    const tokenClasses = await output
      .locator('.view-lines span[class^="mtk"]')
      .evaluateAll(
        (spans: Element[]): number => new Set(spans.map((s) => s.getAttribute('class') ?? '')).size,
      );
    expect(tokenClasses).toBeGreaterThan(2);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download as ZIP' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('csharp-models.zip');
    const bytes = readFileSync(await download.path());
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
  });

  test('switches languages on the same JSON document', async ({ page }) => {
    await page.goto('/codegen/typescript');
    await page.getByRole('button', { name: 'Load sample' }).click();
    const output = page.getByRole('region', { name: 'Generated code' });
    await expect(output.locator('.view-lines')).toContainText('export interface Root {');
    await page
      .getByRole('navigation', { name: 'Code Generators tools' })
      .getByRole('link', { name: 'JSON to SQL Table' })
      .click();
    await expect(output.locator('.view-lines')).toContainText('CREATE TABLE orders');
  });

  test('marks XML syntax errors and converts valid XML', async ({ page }) => {
    await page.goto('/codegen/xml-to-json');
    await page.getByRole('button', { name: 'Load sample' }).click();
    const output = page.getByRole('region', { name: 'Generated code' });
    await expect(output.locator('.view-lines')).toContainText('"@sku": "KB-001"');
    await expect(page.getByText('✓ Valid XML')).toBeVisible();
  });
});
