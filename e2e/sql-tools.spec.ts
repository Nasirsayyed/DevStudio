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

  test('SQLite Playground runs SQL with WebAssembly in a worker and can stop a runaway query', async ({
    page,
  }) => {
    await page.goto('/sql/playground');
    await page.getByRole('button', { name: 'Load sample' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    const result = page.getByRole('region', { name: 'Result 1' });
    await expect(result).toContainText('Result 1: 3 rows');
    await expect(result.getByRole('grid')).toContainText('Ahmed');
    await expect(page.getByRole('tab', { name: 'Schema (2)' })).toBeVisible();

    // An endless recursive query keeps the worker busy; Stop terminates it and the page stays usable.
    await setEditor(
      page,
      'SQL script',
      'WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n) SELECT COUNT(*) FROM n;',
    );
    await page.getByRole('button', { name: 'Run' }).click();
    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByText(/The query was stopped/)).toBeVisible();
    await setEditor(page, 'SQL script', 'SELECT 41 + 1 AS answer;');
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('region', { name: 'Result 1' }).getByRole('grid')).toContainText(
      '42',
    );

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Database' }).click();
    await page.getByRole('menuitem', { name: 'Download .sqlite file' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.sqlite$/);
  });

  test('Schema Designer draws the diagram and generates DDL that runs in the playground', async ({
    page,
  }) => {
    await page.goto('/sql/schema-designer');
    await page.getByRole('combobox', { name: 'Dialect' }).click();
    await page.getByRole('option', { name: 'SQLite' }).click();
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Load the sample design' }).click();
    const diagram = page.getByRole('img', { name: /Diagram of 2 tables: customers, orders/ });
    await expect(diagram).toBeVisible();
    await expect(
      diagram.locator('svg text').filter({ hasText: 'customers' }).first(),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'DDL' }).click();
    await page.getByRole('button', { name: 'Run in SQLite Playground' }).click();
    await expect(page).toHaveURL(/\/sql\/playground$/);
    await page.getByRole('button', { name: 'Run' }).click();
    // The first run loads SQLite (WebAssembly) in a worker, which can be slow on a busy machine.
    await expect(page.getByRole('tab', { name: 'Schema (2)' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Done. The statements returned no rows.')).toBeVisible();
  });
});
