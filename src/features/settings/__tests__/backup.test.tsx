import { screen, waitFor, within } from '@testing-library/react';
import { saveAs } from 'file-saver';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyRequest } from '@/core/http/model';
import { db } from '@/services/db/database';
import { apiCollectionsRepository } from '@/services/db/repositories/apiCollectionsRepository';
import { toolHistoryRepository } from '@/services/db/repositories';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { renderApp, resetAppState } from '@/test/renderApp';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

async function seed() {
  const c = await apiCollectionsRepository.saveCollection({ name: 'Shop' });
  await apiCollectionsRepository.saveRequest({
    collectionId: c.id,
    folderId: null,
    draft: emptyRequest({
      name: 'Me',
      url: 'https://api.test/me',
      auth: { ...emptyRequest().auth, type: 'bearer', token: 'consented-token' },
    }),
  });
  await toolHistoryRepository.record({
    toolId: 'json.formatter',
    label: 'Formatted',
    input: '{}',
    output: '{}',
  });
}

async function downloadedBackup(): Promise<File> {
  await waitFor(() => {
    expect(saveAs).toHaveBeenCalled();
  });
  const [blob, name] = vi.mocked(saveAs).mock.calls[0] as [Blob, string];
  return new File([await blob.text()], name, { type: 'application/json' });
}

beforeEach(async () => {
  await resetAppState();
  vi.mocked(saveAs).mockClear();
});

describe('Backup and restore', () => {
  it('shows stored item counts, downloads a backup without secrets and restores it', async () => {
    await seed();
    usePreferencesStore.setState({ themeMode: 'dark' });
    const { user } = renderApp('/settings');
    const items = await screen.findByRole('table', { name: 'Stored items' });
    await waitFor(() => {
      expect(within(items).getByRole('row', { name: /Saved API requests 1/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    const file = await downloadedBackup();
    expect(file.name).toMatch(/^devstudio-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const text = await file.text();
    expect(text).not.toContain('consented-token');
    expect(text).toContain('"themeMode":"dark"');

    // Lose everything, then restore.
    await Promise.all(db.tables.map((t) => t.clear()));
    usePreferencesStore.setState({ themeMode: 'light' });
    await user.upload(screen.getByLabelText('Choose backup file', { selector: 'input' }), file);
    const dialog = await screen.findByRole('dialog', { name: 'Restore backup' });
    expect(within(dialog).getByRole('table', { name: 'Backup contents' })).toHaveTextContent(
      'Tool history1',
    );
    expect(dialog).toHaveTextContent('Preferences (theme, editor) are included.');
    await user.click(within(dialog).getByRole('button', { name: 'Restore' }));
    expect(
      await screen.findByText(/Restored \d+ item\(s\) and your preferences\./),
    ).toBeInTheDocument();
    expect(await db.apiRequests.count()).toBe(1);
    expect(await db.toolHistory.count()).toBe(1);
    expect(usePreferencesStore.getState().themeMode).toBe('dark');
  });

  it('includes secrets only when asked, and replace mode asks for confirmation', async () => {
    await seed();
    const { user } = renderApp('/settings');
    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Include saved credentials and stored secret values',
      }),
    );
    expect(screen.getByText(/in plain text\. Keep it private\./)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /^History/ }));
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    const file = await downloadedBackup();
    expect(await file.text()).toContain('consented-token');
    expect(await file.text()).not.toContain('"toolHistory"');

    await toolHistoryRepository.record({
      toolId: 'x',
      label: 'kept in merge, not in replace',
      input: '',
      output: '',
    });
    await user.upload(screen.getByLabelText('Choose backup file', { selector: 'input' }), file);
    const dialog = await screen.findByRole('dialog', { name: 'Restore backup' });
    expect(dialog).toHaveTextContent('This backup contains credentials and secret values.');
    await user.click(within(dialog).getByRole('radio', { name: /^Replace/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Restore' }));
    await user.click(await screen.findByRole('button', { name: 'Replace' }));
    expect(await screen.findByText(/Restored \d+ item\(s\)/)).toBeInTheDocument();
    // History was not in the backup, so it was not replaced.
    expect(await db.toolHistory.count()).toBe(2);
  });

  it('rejects files that are not backups', async () => {
    const { user } = renderApp('/settings');
    await user.upload(
      await screen.findByLabelText('Choose backup file', { selector: 'input' }),
      new File(['{"hello":1}'], 'x.json', { type: 'application/json' }),
    );
    expect(await screen.findByText('This is not a DevStudio backup file.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes all data after confirmation', async () => {
    await seed();
    usePreferencesStore.setState({ themeMode: 'dark' });
    const { user } = renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Delete all data…' }));
    await user.click(await screen.findByRole('button', { name: 'Delete everything' }));
    expect(await screen.findByText(/All data was deleted\./)).toBeInTheDocument();
    expect(await db.apiRequests.count()).toBe(0);
    expect(await db.collections.count()).toBe(0);
    expect(usePreferencesStore.getState().themeMode).toBe('system');
  });
});
