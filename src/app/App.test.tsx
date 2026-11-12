import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/services/db/database';
import { PREFERENCES_STORAGE_KEY } from '@/services/preferences/preferences';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { renderApp, resetAppState } from '@/test/renderApp';

beforeEach(async () => {
  await resetAppState();
});

describe('application shell', () => {
  it('renders the dashboard with sidebar, top bar and breadcrumbs', async () => {
    renderApp('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: /good|working late/i }),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    for (const label of [
      'Dashboard',
      'API Testing',
      'JSON Studio',
      'Code Generators',
      'SQL Tools',
      'Developer Utilities',
      'Text Tools',
      'Snippet Manager',
      'History',
      'Favorites',
      'Settings',
    ]) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Search tools and saved work' })).toBeInTheDocument();
  });

  it('navigates via the sidebar and updates breadcrumbs', async () => {
    const { user } = renderApp('/');
    await user.click(
      within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', {
        name: 'JSON Studio',
      }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'JSON Studio' }),
    ).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(crumbs).getByText('JSON Studio')).toHaveAttribute('aria-current', 'page');
    // Overview lists the module's tools
    expect(screen.getByRole('link', { name: /JSON Formatter/ })).toHaveAttribute(
      'href',
      '/json/formatter',
    );
  });

  it('collapses the sidebar and persists the choice', async () => {
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(usePreferencesStore.getState().sidebarCollapsed).toBe(true);
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toContain(
      '"sidebarCollapsed":true',
    );
  });

  it('switches theme from the top bar and persists it', async () => {
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: /Theme: system/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Dark' }));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toContain('"themeMode":"dark"');
  });

  it('shows a 404 page for unknown routes and unknown tools', async () => {
    renderApp('/does-not-exist');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('shows a 404 page for unknown tool slugs', async () => {
    renderApp('/json/not-a-tool');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});

describe('tool routes', () => {
  it('renders a scheduled tool honestly and records usage', async () => {
    renderApp('/api/requests');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Request Builder' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Scheduled for Phase 10')).toBeInTheDocument();
    await waitFor(async () => {
      expect((await db.toolUsage.get('api.requests'))?.count).toBeGreaterThanOrEqual(1);
    });
    expect(usePreferencesStore.getState().recentToolIds[0]).toBe('api.requests');
  });

  it('redirects alias tools to their canonical tool', async () => {
    const { router } = renderApp('/codegen/json-to-csv');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'JSON to CSV' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/json/to-csv');
  });

  it('toggles a favorite from the tool header and shows it on the Favorites page', async () => {
    const { user, router } = renderApp('/utils/jwt-decoder');
    const star = await screen.findByRole('button', { name: 'Add to favorites' });
    await user.click(star);
    expect(await screen.findByRole('button', { name: 'Remove from favorites' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await act(() => router.navigate('/favorites'));
    const section = await screen.findByRole('region', { name: 'Favorite tools' });
    expect(await within(section).findByRole('link', { name: /JWT Decoder/ })).toBeInTheDocument();
  });
});
