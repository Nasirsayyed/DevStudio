import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** One representative page per area, plus the shell pages. */
const PAGES = [
  '/',
  '/favorites',
  '/settings',
  '/history',
  '/snippets',
  '/api',
  '/api/requests',
  '/api/environments',
  '/api/runner',
  '/api/history',
  '/api/compare',
  '/json/formatter',
  '/json/tree',
  '/codegen/csharp',
  '/sql/formatter',
  '/sql/query-generator',
  '/sql/schema-designer',
  '/sql/playground',
  '/utils/jwt-decoder',
  '/utils/password',
  '/utils/color',
  '/text/text-diff',
  '/text/markdown-preview',
  '/text/case-converter',
];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Monaco renders its own (third-party) DOM; its textarea is labelled by the editors' ariaLabel.
    .exclude('.monaco-editor')
    .analyze();
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact ?? 'n/a'}): ${v.help}\n    ${v.nodes
        .slice(0, 3)
        .map(
          (n) =>
            `${n.target.join(' ')} ${n.html.slice(0, 120)} ${(n.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 160)}`,
        )
        .join('\n    ')}`,
  );
}

test.describe('Accessibility (axe, WCAG 2.1 A/AA)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`all main pages have no violations (${scheme} theme)`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ colorScheme: scheme });
      const report: string[] = [];
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        // Let lazy panels and live queries settle.
        await page.waitForLoadState('networkidle');
        const violations = await scan(page);
        if (violations.length) report.push(`${path}\n  ${violations.join('\n  ')}`);
      }
      expect(report, report.join('\n\n')).toEqual([]);
    });
  }

  test('pages with data and open overlays have no violations', async ({ page }) => {
    await page.route('https://api.example.test/**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '{"ok":true,"items":[1,2,3]}',
      }),
    );
    await page.goto('/api/requests');
    await page.getByRole('textbox', { name: 'URL' }).fill('https://api.example.test/items');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByRole('region', { name: 'Response' }).getByLabel('Status')).toHaveText(
      /200/,
    );
    expect(await scan(page)).toEqual([]);

    await page.goto('/history');
    await expect(page.getByRole('list', { name: 'History entries' })).toBeVisible();
    expect(await scan(page)).toEqual([]);

    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.type('json');
    expect(await scan(page)).toEqual([]);
  });
});
