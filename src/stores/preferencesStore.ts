import { create } from 'zustand';
import {
  type EditorPreferences,
  MAX_RECENT_TOOLS,
  type Preferences,
  type ThemeMode,
  loadPreferences,
  savePreferences,
} from '@/services/preferences/preferences';

interface PreferencesActions {
  setThemeMode: (mode: ThemeMode) => void;
  /** Cycles light → dark → system → light. */
  cycleThemeMode: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setEditorPreferences: (patch: Partial<EditorPreferences>) => void;
  setSelectedEnvironmentId: (id: string | null) => void;
  pushRecentTool: (toolId: string) => void;
  clearRecentTools: () => void;
}

export type PreferencesState = Preferences & PreferencesActions;

const THEME_CYCLE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

export const usePreferencesStore = create<PreferencesState>()((set) => ({
  ...loadPreferences(),
  setThemeMode: (themeMode) => set({ themeMode }),
  cycleThemeMode: () => set((s) => ({ themeMode: THEME_CYCLE[s.themeMode] })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setEditorPreferences: (patch) => set((s) => ({ editor: { ...s.editor, ...patch } })),
  setSelectedEnvironmentId: (selectedEnvironmentId) => set({ selectedEnvironmentId }),
  pushRecentTool: (toolId) =>
    set((s) => {
      if (s.recentToolIds[0] === toolId) return s;
      return {
        recentToolIds: [toolId, ...s.recentToolIds.filter((id) => id !== toolId)].slice(
          0,
          MAX_RECENT_TOOLS,
        ),
      };
    }),
  clearRecentTools: () => set({ recentToolIds: [] }),
}));

/** Persist only the data fields (not actions) whenever they change. */
function snapshot(s: PreferencesState): Preferences {
  return {
    themeMode: s.themeMode,
    sidebarCollapsed: s.sidebarCollapsed,
    selectedEnvironmentId: s.selectedEnvironmentId,
    editor: s.editor,
    recentToolIds: s.recentToolIds,
  };
}

usePreferencesStore.subscribe((state, prev) => {
  if (
    state.themeMode !== prev.themeMode ||
    state.sidebarCollapsed !== prev.sidebarCollapsed ||
    state.selectedEnvironmentId !== prev.selectedEnvironmentId ||
    state.editor !== prev.editor ||
    state.recentToolIds !== prev.recentToolIds
  ) {
    savePreferences(snapshot(state));
  }
});
