import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/services/db/database';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { renderApp, resetAppState } from '@/test/renderApp';

beforeEach(async () => {
  await resetAppState();
});

describe('SettingsPage', () => {
  it('changes theme and editor preferences', async () => {
    const { user } = renderApp('/settings');
    await user.click(await screen.findByRole('radio', { name: 'Light' }));
    expect(usePreferencesStore.getState().themeMode).toBe('light');
    await user.click(screen.getByRole('switch', { name: 'Show minimap' }));
    expect(usePreferencesStore.getState().editor.minimap).toBe(true);
  });

  it('resets usage statistics after confirmation', async () => {
    await db.toolUsage.put({ toolId: 'json.formatter', count: 3, lastUsedAt: 1 });
    usePreferencesStore.setState({ recentToolIds: ['json.formatter'] });
    const { user } = renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Reset usage statistics' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset usage statistics?' });
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(async () => {
      expect(await db.toolUsage.count()).toBe(0);
    });
    expect(dialog).not.toBeVisible();
    expect(usePreferencesStore.getState().recentToolIds).toEqual([]);
  });

  it('keeps data when the confirmation is cancelled', async () => {
    await db.toolUsage.put({ toolId: 'json.formatter', count: 3, lastUsedAt: 1 });
    const { user } = renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Reset usage statistics' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await db.toolUsage.count()).toBe(1);
  });
});
