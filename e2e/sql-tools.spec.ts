import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function setEditor(page: Page, panel: string, text: string) {
  const editor = page.getByRole('region', { name: panel }).locator('.monaco-editor').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press('ControlOrMeta+v');
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('SQL Tools (real Monaco, workers, production CSP)', () => {
  test('formats SQL with highlighting and validates it with the dialect parser', async ({
    page,
  }) => {
    await page.goto('/sql/formatter');
    await setEditor(page, 'SQL input', 'select a,b from t where x=1');
    const out = page.getByRole('region', { name: 'Output' });
    await expect(out.locator('.view-lines')).toContainText('SELECT');
    await expect(
      out.locator('.view-lines .mtk1, .view-lines [class*="mtk"]').first(),
    ).toBeVisible();

    await page.goto('/sql/validator');
    await setEditor(
      page,
      'SQL input',
      'SELECT id FROM users;\nUPDATE users SET a = 1;\nSELECT a FORM t;',
    );
    const problems = page.getByRole('list', { name: 'Problems' });
    await expect(problems).toContainText('UPDATE without WHERE');
    await expect(problems).toContainText('Line 3');
  });

  test('large scripts are formatted in a worker that loads the parser on demand', async ({
    page,
  }) => {
    const big = Array.from(
      { length: 4000 },
      (_, i) =>
        `select col_${String(i)}, other from table_${String(i % 7)} where id = ${String(i)};`,
    ).join('\n');
    await page.goto('/sql/validator');
    await setEditor(page, 'SQL input', big);
    await expect(page.getByText('4000 statements parsed without problems.')).toBeVisible({
      timeout: 20_000,
    });
  });

  test('generates C# from CREATE TABLE and builds statements', async ({ page }) => {
    await page.goto('/sql/to-csharp');
    await page.getByRole('combobox', { name: 'Dialect' }).click();
    await page.getByRole('option', { name: 'SQL Server (T-SQL)' }).click();
    await page
      .getByRole('region', { name: 'CREATE TABLE statements' })
      .getByRole('button', { name: 'Load sample' })
      .click();
    const out = page.getByRole('region', { name: 'Generated code' });
    await expect(out.locator('.view-lines')).toContainText('public class Customer');

    await page.goto('/sql/select-generator');
    await page.getByRole('combobox', { name: 'Table' }).click();
    await page.getByRole('option', { name: /^dbo\.Orders/ }).click();
    await page.getByRole('checkbox', { name: /Customers/ }).check();
    // Columns of the joined table are selected with its alias.
    const statement = page
      .getByRole('region', { name: 'Statement', exact: true })
      .locator('.view-lines');
    await expect(statement).toContainText('o.CustomerId');
    await expect(statement).toContainText('c.Email');
  });
});
