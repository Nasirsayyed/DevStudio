import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('History, backup and restore (IndexedDB, production CSP)', () => {
  test('a copied result appears in History and can be restored', async ({ page }) => {
    await page.goto('/json/formatter');
    const input = page.getByRole('region', { name: 'Input' }).locator('.monaco-editor').first();
    await input.click();
    await page.evaluate(() => navigator.clipboard.writeText('{"restore":"me"}'));
    await page.keyboard.press('ControlOrMeta+v');
    await page.getByRole('button', { name: 'Copy output' }).first().click();

    await page.goto('/history');
    await page.getByRole('list', { name: 'History entries' }).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Restore in JSON Formatter' }).click();
    await expect(page).toHaveURL(/\/json\/formatter$/);
    await expect(page.getByRole('region', { name: 'Input' }).locator('.view-lines')).toContainText(
      '"restore"',
    );
  });

  test('backup, delete everything, restore', async ({ page }) => {
    await page.goto('/snippets?new=1');
    const form = page.getByRole('form', { name: 'New snippet' });
    await form.getByRole('textbox', { name: 'Title' }).fill('Backed up');
    await form.locator('.monaco-editor').first().click();
    await page.keyboard.type('echo backup');
    await form.getByRole('button', { name: 'Save snippet' }).click();
    await expect(page.getByRole('form', { name: 'Edit Backed up' })).toBeVisible();

    await page.goto('/settings');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download backup' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^devstudio-backup-.*\.json$/);
    const path = await file.path();
    const content = await readFile(path, 'utf8');
    expect(content).toContain('Backed up');

    await page.getByRole('button', { name: 'Delete all data…' }).click();
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.getByText(/All data was deleted/)).toBeVisible();

    await page.getByLabel('Choose backup file').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(content),
    });
    const dialog = page.getByRole('dialog', { name: 'Restore backup' });
    await expect(dialog.getByRole('table', { name: 'Backup contents' })).toContainText('Snippets');
    await dialog.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText(/Restored \d+ item/)).toBeVisible();
    await page.getByRole('button', { name: 'Reload now' }).click();

    await page.goto('/snippets');
    await expect(page.getByRole('option', { name: 'Backed up' })).toBeVisible();
  });
});
