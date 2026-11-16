import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyRequest } from '@/core/http/model';
import { db } from '@/services/db/database';
import { toolHistoryRepository } from '@/services/db/repositories';
import { apiHistoryRepository } from '@/services/db/repositories/apiHistoryRepository';
import { useApiWorkspaceStore } from '@/stores/apiWorkspaceStore';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { renderApp, resetAppState } from '@/test/renderApp';

async function seed() {
  await toolHistoryRepository.record({
    toolId: 'json.formatter',
    label: 'JSON Formatter (copy)',
    input: '{"a":1}',
    output: '{\n  "a": 1\n}',
  });
  await toolHistoryRepository.record({
    toolId: 'sql.formatter',
    label: 'SQL Formatter (copy)',
    input: 'select 1',
    output: 'SELECT\n  1',
    options: { dialect: 'mysql' },
  });
  await toolHistoryRepository.record({
    toolId: 'utils.uuid',
    label: 'UUID (copy)',
    input: '',
    output: '0190…',
  });
  await apiHistoryRepository.record({
    requestId: null,
    snapshot: {
      request: { method: 'POST', url: 'https://api.test/orders', headers: [], body: '{}' },
      response: {
        status: 201,
        statusText: 'Created',
        headers: [],
        contentType: 'application/json',
        body: '{"id":9}',
        bodyTruncated: false,
        sizeBytes: 8,
        durationMs: 12,
      },
      error: null,
      draft: emptyRequest({
        method: 'POST',
        url: 'https://api.test/orders',
        name: 'Create',
      }),
      environment: null,
    },
  });
}

beforeEach(async () => {
  await resetAppState();
});

describe('History', () => {
  it('lists tool runs and API requests together, filters and searches them', async () => {
    await seed();
    const { user } = renderApp('/history');
    const list = await screen.findByRole('list', { name: 'History entries' });
    await waitFor(() => {
      expect(within(list).getAllByRole('button')).toHaveLength(4);
    });
    expect(screen.getByText('4 of 4 entries')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'API requests' }));
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.click(screen.getByRole('combobox', { name: 'Module' }));
    await user.click(screen.getByRole('option', { name: 'SQL Tools' }));
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    await user.click(screen.getByRole('combobox', { name: 'Module' }));
    await user.click(screen.getByRole('option', { name: 'All modules' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search history' }), 'uuid');
    await waitFor(() => {
      expect(screen.getByText('1 of 4 entries')).toBeInTheDocument();
    });
    // UUIDs have no input to restore.
    expect(screen.queryByRole('button', { name: /^Restore in/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open tool' })).toBeInTheDocument();
  });

  it('restores a tool input into its workspace and opens the tool', async () => {
    await seed();
    const { user, router } = renderApp('/history');
    const list = await screen.findByRole('list', { name: 'History entries' });
    await user.click(await within(list).findByRole('button', { name: /SQL Formatter \(copy\)/ }));
    const entry = screen.getByRole('region', { name: 'History entry' });
    expect(
      within(entry).getByRole<HTMLTextAreaElement>('textbox', { name: 'History input' }).value,
    ).toBe('select 1');
    await user.click(within(entry).getByRole('button', { name: 'Restore in SQL Formatter' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sql/formatter');
    });
    expect(useSqlWorkspaceStore.getState()).toMatchObject({ sql: 'select 1', dialect: 'mysql' });

    await act(() => router.navigate('/history'));
    await user.click(await screen.findByRole('button', { name: /JSON Formatter \(copy\)/ }));
    await user.click(screen.getByRole('button', { name: 'Restore in JSON Formatter' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/json/formatter');
    });
    expect(useJsonWorkspaceStore.getState().input).toBe('{"a":1}');
  });

  it('reopens API requests, deletes entries and clears history', async () => {
    await seed();
    const { user, router } = renderApp('/history');
    await user.click(
      await screen.findByRole('button', { name: /POST https:\/\/api\.test\/orders/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Open in Request Builder' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/api/requests');
    });
    expect(useApiWorkspaceStore.getState().draft).toMatchObject({
      method: 'POST',
      url: 'https://api.test/orders',
    });

    await act(() => router.navigate('/history'));
    await user.click(await screen.findByRole('button', { name: /UUID \(copy\)/ }));
    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    await waitFor(async () => {
      expect(await db.toolHistory.count()).toBe(2);
    });

    await user.click(screen.getByRole('button', { name: 'Clear…' }));
    await user.click(screen.getByRole('menuitem', { name: 'Clear tool history' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clear' }),
    );
    await waitFor(async () => {
      expect(await db.toolHistory.count()).toBe(0);
    });
    expect(await db.apiHistory.count()).toBe(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Clear…' }));
    await user.click(screen.getByRole('menuitem', { name: 'Clear all history' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clear' }),
    );
    expect(await screen.findByText('No history yet')).toBeInTheDocument();
  });
});
