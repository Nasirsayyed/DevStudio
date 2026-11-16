import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { snippetsRepository } from '@/services/db/repositories/snippetsRepository';
import { renderApp, resetAppState } from '@/test/renderApp';

beforeEach(async () => {
  await resetAppState();
});

describe('Favorites', () => {
  it('lists favorite snippets next to favorite tools and opens them', async () => {
    const base = { description: '', code: 'echo 1', language: 'shell', category: 'Ops', tags: [] };
    const fav = await snippetsRepository.save({ ...base, title: 'Deploy', isFavorite: true });
    await snippetsRepository.save({ ...base, title: 'Not starred' });
    const { user, router } = renderApp('/favorites');
    const list = await screen.findByRole('list', { name: 'Favorite snippets' });
    await waitFor(() => {
      expect(within(list).getAllByRole('link')).toHaveLength(1);
    });
    await user.click(within(list).getByRole('link', { name: /Deploy/ }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/snippets');
    });
    expect(router.state.location.search).toContain(fav.id);
  });

  it('explains how to add favorite snippets', async () => {
    renderApp('/favorites');
    expect(await screen.findByText('No favorite snippets')).toBeInTheDocument();
  });
});
