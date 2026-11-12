import { expect, test } from './fixtures';

test.describe('DevStudio shell', () => {
  test('loads the dashboard and navigates through modules', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('DevStudio');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('link', { name: 'API Testing' }).click();
    await expect(page).toHaveURL(/\/api$/);
    await expect(page.getByRole('heading', { level: 1, name: 'API Testing' })).toBeVisible();
    await page.getByRole('link', { name: /Request Builder/ }).click();
    await expect(page).toHaveURL(/\/api\/requests$/);
    await expect(page.getByText('Scheduled for Phase 10')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('API Testing');
  });

  test('deep links work (SPA fallback) and unknown routes show 404', async ({ page }) => {
    await page.goto('/utils/jwt-decoder');
    await expect(page.getByRole('heading', { level: 1, name: 'JWT Decoder' })).toBeVisible();
    await page.goto('/nope/nothing');
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  test('theme choice persists across reloads', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^Theme:/ }).click();
    await page.getByRole('menuitem', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(11, 15, 23)');
  });

  test('sidebar collapse persists across reloads', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  });

  test('command palette: Ctrl+K, search, keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox', { name: 'Search command palette' });
    await expect(input).toBeFocused();
    await input.fill('uuid');
    await expect(page.getByRole('option').first()).toContainText('UUID Generator');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/utils\/uuid$/);
  });

  test('favorites persist in IndexedDB and show on the dashboard', async ({ page }) => {
    await page.goto('/sql/formatter');
    await page.getByRole('button', { name: 'Add to favorites' }).click();
    await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();
    await page.goto('/');
    const favorites = page.getByRole('region', { name: 'Favorite tools' });
    await expect(favorites.getByRole('link', { name: /SQL Formatter/ })).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Recently used' })
        .getByRole('link', { name: /SQL Formatter/ }),
    ).toBeVisible();
  });
});

test.describe('responsive layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('uses a drawer navigation on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();
    await nav.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(nav).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, 'no horizontal page scroll').toBe(false);
  });

  test('tool pages fit the screen and breadcrumbs never overlap the top bar', async ({ page }) => {
    await page.goto('/json/formatter');
    await page.getByRole('button', { name: 'Load sample' }).click();
    await expect(page.getByText('✓ Valid JSON')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, 'no horizontal page scroll').toBe(false);
    const current = page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .locator('[aria-current="page"]');
    await expect(current).toHaveText('JSON Formatter');
    const crumbs = await current.boundingBox();
    const search = await page.getByRole('button', { name: 'Open search' }).boundingBox();
    expect(crumbs && search && crumbs.x + crumbs.width <= search.x).toBe(true);
  });
});
