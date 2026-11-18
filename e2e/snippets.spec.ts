import { expect, test } from './fixtures';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('Snippet Manager (IndexedDB, real Monaco, production CSP)', () => {
  test('create, search, persist across reloads, copy and delete with undo', async ({ page }) => {
    await page.goto('/snippets');
    await expect(page.getByText('Your snippet library is empty')).toBeVisible();
    await page.getByRole('button', { name: 'New snippet' }).first().click();
    const form = page.getByRole('form', { name: 'New snippet' });
    await form.getByRole('textbox', { name: 'Title' }).fill('Sleep helper');
    await form.getByRole('combobox', { name: 'Tags' }).fill('async');
    await form.getByRole('combobox', { name: 'Tags' }).press('Enter');
    const editor = form.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.type(
      'const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));',
    );
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByText('Saved “Sleep helper”.')).toBeVisible();
    await expect(page).toHaveURL(/\/snippets\?snippet=/);

    await page.reload();
    const edit = page.getByRole('form', { name: 'Edit Sleep helper' });
    await expect(edit.locator('.view-lines')).toContainText('const sleep');
    await expect(page.getByRole('option', { name: 'Sleep helper' })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Search snippets' }).fill('setTimeout');
    await expect(page.getByRole('listbox', { name: 'Snippets' }).getByRole('option')).toHaveCount(
      1,
    );
    await page.getByRole('searchbox', { name: 'Search snippets' }).fill('nothing-like-this');
    await expect(page.getByText('No matching snippets')).toBeVisible();

    await edit.getByRole('button', { name: 'Copy code' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('const sleep');

    await edit.getByRole('button', { name: 'Delete snippet' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('form', { name: 'Edit Sleep helper' })).toBeVisible();
  });

  test('fast typing in the code editor never loses keystrokes', async ({ page }) => {
    // Regression: the form echoed stale values back into Monaco, which dropped characters.
    const text = 'const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));';
    await page.goto('/snippets?new=1');
    const form = page.getByRole('form', { name: 'New snippet' });
    await form.getByRole('textbox', { name: 'Title' }).fill('Typing');
    await form.locator('.monaco-editor').first().click();
    await page.keyboard.type(text);
    await form.getByRole('button', { name: 'Save snippet' }).click();
    await expect(page.getByRole('form', { name: 'Edit Typing' })).toBeVisible();
    const saved = await page.evaluate(
      () =>
        new Promise<string>((resolve, reject) => {
          const open = indexedDB.open('devstudio');
          open.onerror = () => reject(new Error('open failed'));
          open.onsuccess = () => {
            const req = open.result
              .transaction('codeSnippets')
              .objectStore('codeSnippets')
              .getAll();
            req.onsuccess = () => resolve((req.result as { code: string }[])[0]?.code ?? '');
          };
        }),
    );
    expect(saved).toBe(text);
  });

  test('unsaved changes are protected when closing the tab', async ({ page }) => {
    await page.goto('/snippets?new=1');
    const title = page
      .getByRole('form', { name: 'New snippet' })
      .getByRole('textbox', { name: 'Title' });
    // A real click and typing give the page the user activation browsers require for the prompt.
    await title.click();
    await page.keyboard.type('Draft');
    const dialog = page.waitForEvent('dialog');
    await page.close({ runBeforeUnload: true });
    const prompt = await dialog;
    expect(prompt.type()).toBe('beforeunload');
    await prompt.dismiss();
    expect(page.isClosed()).toBe(false);
  });

  test('imports a VS Code snippets file and exports the library', async ({ page }) => {
    await page.goto('/snippets');
    await page.getByRole('button', { name: 'Import' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Import snippets' });
    await dialog.getByLabel('Choose file').setInputFiles({
      name: 'react.code-snippets',
      mimeType: 'application/json',
      buffer: Buffer.from(
        '{\n // React\n "useState": { "prefix": "us", "body": ["const [$1, set$1] = useState($2);"], "scope": "typescriptreact" },\n "Effect": { "prefix": "ue", "body": "useEffect(() => {\\n  $0\\n}, []);", "scope": "typescriptreact" },\n}',
      ),
    });
    await expect(dialog.getByText(/2 snippets ready to import/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByText('Import finished: 2 added.')).toBeVisible();
    await expect(page.getByRole('listbox', { name: 'Snippets' }).getByRole('option')).toHaveCount(
      2,
    );

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('menuitem', { name: 'All as VS Code snippets' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.code-snippets$/);
  });

  test('phone layout: list, then editor with a back button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/snippets?new=1');
    const form = page.getByRole('form', { name: 'New snippet' });
    await form.getByRole('textbox', { name: 'Title' }).fill('Phone');
    await form.locator('.monaco-editor').first().click();
    await page.keyboard.type('echo hi');
    await form.getByRole('button', { name: 'Save snippet' }).click();
    await expect(page.getByRole('form', { name: 'Edit Phone' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to the list' }).click();
    await expect(page.getByRole('option', { name: 'Phone' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
});
