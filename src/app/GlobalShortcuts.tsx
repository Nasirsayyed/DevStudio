import { useNavigate } from 'react-router';
import { useHotkey } from '@/hooks/useHotkey';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useUiStore } from '@/stores/uiStore';
import { getTool, toolPath } from '@/tools/toolRegistry';
import { useQuickAccessIds } from '@/hooks/useQuickAccess';
import { SHORTCUTS } from './shortcuts';

const QUICK_ACCESS_COMBOS = Array.from({ length: 9 }, (_, i) => `alt+${i + 1}`);

/** Registers app-wide keyboard shortcuts. Renders nothing. */
export function GlobalShortcuts() {
  const navigate = useNavigate();
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette);
  const setShortcutsDialogOpen = useUiStore((s) => s.setShortcutsDialogOpen);
  const toggleSidebarCollapsed = usePreferencesStore((s) => s.toggleSidebarCollapsed);
  const cycleThemeMode = usePreferencesStore((s) => s.cycleThemeMode);
  const quickAccess = useQuickAccessIds();

  useHotkey(SHORTCUTS.commandPalette.combo, toggleCommandPalette);
  useHotkey(SHORTCUTS.toggleSidebar.combo, toggleSidebarCollapsed);
  useHotkey(SHORTCUTS.toggleTheme.combo, cycleThemeMode);
  useHotkey(SHORTCUTS.shortcutsHelp.combo, () => {
    setShortcutsDialogOpen(true);
  });
  useHotkey(SHORTCUTS.goDashboard.combo, () => {
    void navigate('/');
  });
  useHotkey(QUICK_ACCESS_COMBOS, (event) => {
    const index = Number(event.code.replace('Digit', '')) - 1;
    const tool = getTool(quickAccess?.[index] ?? '');
    if (tool) void navigate(toolPath(tool));
  });

  return null;
}
