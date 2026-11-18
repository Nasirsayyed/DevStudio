import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  loadPreferences,
} from '@/services/preferences/preferences';
import { usePreferencesStore } from './preferencesStore';

describe('preferences store', () => {
  beforeEach(() => {
    usePreferencesStore.setState(DEFAULT_PREFERENCES);
    window.localStorage.clear();
  });

  it('persists theme changes to localStorage (theme persistence)', () => {
    usePreferencesStore.getState().setThemeMode('dark');
    expect(loadPreferences().themeMode).toBe('dark');
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toContain('"themeMode":"dark"');
  });

  it('cycles theme light → dark → system → light', () => {
    const { setThemeMode, cycleThemeMode } = usePreferencesStore.getState();
    setThemeMode('light');
    cycleThemeMode();
    expect(usePreferencesStore.getState().themeMode).toBe('dark');
    cycleThemeMode();
    expect(usePreferencesStore.getState().themeMode).toBe('system');
    cycleThemeMode();
    expect(usePreferencesStore.getState().themeMode).toBe('light');
  });

  it('persists sidebar state', () => {
    usePreferencesStore.getState().toggleSidebarCollapsed();
    expect(loadPreferences().sidebarCollapsed).toBe(true);
  });

  it('keeps most-recent-first unique recent tools, capped at 10', () => {
    const { pushRecentTool } = usePreferencesStore.getState();
    for (let i = 0; i < 12; i++) pushRecentTool(`tool.${i}`);
    pushRecentTool('tool.5');
    const recent = usePreferencesStore.getState().recentToolIds;
    expect(recent[0]).toBe('tool.5');
    expect(recent).toHaveLength(10);
    expect(new Set(recent).size).toBe(10);
    expect(loadPreferences().recentToolIds).toEqual(recent);
  });

  it('merges editor preference patches', () => {
    usePreferencesStore.getState().setEditorPreferences({ fontSize: 16 });
    expect(usePreferencesStore.getState().editor).toEqual({
      ...DEFAULT_PREFERENCES.editor,
      fontSize: 16,
    });
  });
});
