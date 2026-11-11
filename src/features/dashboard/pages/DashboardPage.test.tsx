import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { QUICK_ACCESS_SETTING_KEY } from '@/hooks/useQuickAccess';
import { db } from '@/services/db/database';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { renderApp, resetAppState } from '@/test/renderApp';
import { CANONICAL_TOOLS } from '@/tools/toolRegistry';

beforeEach(async () => {
  await resetAppState();
});

describe('DashboardPage', () => {
  it('derives statistics from local IndexedDB data', async () => {
    await db.jsonDocuments.bulkAdd([
      {
        id: 'd1',
        name: 'Invoice sample',
        content: '{}',
        sizeBytes: 2048,
        tags: [],
        createdAt: 1,
        updatedAt: Date.now(),
      },
      {
        id: 'd2',
        name: 'Users',
        content: '[]',
        sizeBytes: 2,
        tags: [],
        createdAt: 1,
        updatedAt: Date.now() - 1000,
      },
    ]);
    renderApp('/');
    const stats = await screen.findByRole('region', { name: 'Workspace statistics' });
    expect(
      within(stats).getByRole('link', { name: `Tools: ${CANONICAL_TOOLS.length}` }),
    ).toBeInTheDocument();
    expect(await within(stats).findByRole('link', { name: 'JSON docs: 2' })).toBeInTheDocument();
    expect(within(stats).getByRole('link', { name: 'Snippets: 0' })).toBeInTheDocument();

    const docs = screen.getByRole('region', { name: 'Saved JSON documents' });
    const items = await within(docs).findAllByRole('link');
    expect(items[0]).toHaveTextContent('Invoice sample');
    expect(items[0]).toHaveTextContent('2 KB');
  });

  it('shows empty states when there is no data', async () => {
    renderApp('/');
    expect(await screen.findByText('No requests yet')).toBeInTheDocument();
    expect(screen.getByText('No snippets yet')).toBeInTheDocument();
    expect(await screen.findByText('No usage yet')).toBeInTheDocument();
    expect(screen.getByText('No favorites')).toBeInTheDocument();
  });

  it('lists recently used tools from preferences', async () => {
    usePreferencesStore.setState({ recentToolIds: ['sql.formatter', 'utils.uuid'] });
    renderApp('/');
    const recent = await screen.findByRole('region', { name: 'Recently used' });
    const links = within(recent).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/sql/formatter', '/utils/uuid']);
  });

  it('searches all tools inline', async () => {
    const { user } = renderApp('/');
    await user.type(await screen.findByRole('searchbox', { name: 'Search all tools' }), 'c#');
    const results = await screen.findByRole('list', { name: 'Tool search results' });
    const hrefs = within(results)
      .getAllByRole('link')
      .map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/codegen/csharp', '/sql/to-csharp']));
    await user.clear(screen.getByRole('searchbox', { name: 'Search all tools' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search all tools' }), 'zzzqqq');
    expect(await screen.findByText(/No tools match/)).toBeInTheDocument();
  });

  it('customizes quick access and persists it to IndexedDB', async () => {
    const { user } = renderApp('/');
    const card = await screen.findByRole('region', { name: 'Quick access' });
    await within(card).findByRole('link', { name: /Request Builder/ });
    await user.click(within(card).getByRole('button', { name: 'Customize' }));
    const dialog = await screen.findByRole('dialog', { name: 'Customize quick access' });
    // Remove the first default (Request Builder) and add the UUID generator.
    await user.click(within(dialog).getByRole('checkbox', { name: /Request Builder/ }));
    await user.type(within(dialog).getByRole('searchbox', { name: 'Filter tools' }), 'uuid');
    await user.click(within(dialog).getByRole('checkbox', { name: /UUID Generator/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const row = await db.settings.get(QUICK_ACCESS_SETTING_KEY);
      expect(row?.value).toEqual(expect.arrayContaining(['utils.uuid']));
      expect(row?.value).not.toEqual(expect.arrayContaining(['api.requests']));
    });
    expect(await within(card).findByRole('link', { name: /UUID Generator/ })).toBeInTheDocument();
    expect(within(card).queryByRole('link', { name: /Request Builder/ })).not.toBeInTheDocument();
  });
});
