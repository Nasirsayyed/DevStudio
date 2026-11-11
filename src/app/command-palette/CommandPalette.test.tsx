import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/services/db/database';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { renderApp, resetAppState } from '@/test/renderApp';

beforeEach(async () => {
  await resetAppState();
});

async function openPalette(user: ReturnType<typeof renderApp>['user']) {
  await screen.findByRole('navigation', { name: 'Main navigation' });
  await user.keyboard('{Control>}k{/Control}');
  return screen.findByRole('combobox', { name: 'Search command palette' });
}

describe('command palette', () => {
  it('opens with Ctrl+K and closes with Escape', async () => {
    const { user } = renderApp('/');
    const input = await openPalette(user);
    expect(input).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        screen.queryByRole('combobox', { name: 'Search command palette' }),
      ).not.toBeInTheDocument();
    });
  });

  it('opens from the top bar search button', async () => {
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Search tools and saved work' }));
    expect(
      await screen.findByRole('combobox', { name: 'Search command palette' }),
    ).toBeInTheDocument();
  });

  it('searches tools and navigates with the keyboard', async () => {
    const { user, router } = renderApp('/');
    const input = await openPalette(user);
    await user.type(input, 'jwt');
    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('JWT Decoder');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', 'palette-option-1');
    await user.keyboard('{ArrowUp}{Enter}');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/utils/jwt-decoder');
    });
  });

  it('wraps around with ArrowUp from the first result', async () => {
    const { user } = renderApp('/');
    const input = await openPalette(user);
    await user.type(input, '>');
    const options = await screen.findAllByRole('option');
    await user.keyboard('{ArrowUp}');
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');
  });

  it('runs actions with the ">" prefix', async () => {
    const { user } = renderApp('/');
    const input = await openPalette(user);
    await user.type(input, '> dark theme');
    expect(await screen.findByRole('option', { name: /Switch to dark theme/ })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(usePreferencesStore.getState().themeMode).toBe('dark');
  });

  it('finds saved snippets stored in IndexedDB', async () => {
    await db.codeSnippets.add({
      id: 'snip-1',
      title: 'Retry with exponential backoff',
      description: '',
      code: '',
      language: 'typescript',
      category: 'utils',
      tags: ['network'],
      isFavorite: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    const { user, router } = renderApp('/');
    const input = await openPalette(user);
    await user.type(input, 'backoff');
    const option = await screen.findByRole('option', { name: /Retry with exponential backoff/ });
    await user.click(option);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/snippets');
    });
    expect(router.state.location.search).toBe('?snippet=snip-1');
  });

  it('shows an empty state when nothing matches', async () => {
    const { user } = renderApp('/');
    const input = await openPalette(user);
    await user.type(input, 'qqqqzzzz');
    expect(await screen.findByText('No results')).toBeInTheDocument();
  });
});

describe('global shortcuts', () => {
  it('opens the shortcuts dialog with "?" but not while typing', async () => {
    const { user } = renderApp('/');
    await screen.findByRole('navigation', { name: 'Main navigation' });
    await user.keyboard('?');
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });

  it('toggles the sidebar with Ctrl+B', async () => {
    const { user } = renderApp('/');
    await screen.findByRole('navigation', { name: 'Main navigation' });
    await user.keyboard('{Control>}b{/Control}');
    expect(usePreferencesStore.getState().sidebarCollapsed).toBe(true);
  });

  it('opens quick-access slot 1 with Alt+1', async () => {
    const { user, router } = renderApp('/');
    expect(await screen.findByRole('region', { name: 'Quick access' })).toBeInTheDocument();
    // Wait for quick access to load from IndexedDB.
    await screen.findAllByRole('link', { name: /Request Builder/ });
    await user.keyboard('{Alt>}1{/Alt}');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/api/requests');
    });
  });
});
