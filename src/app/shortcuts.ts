/** Global keyboard shortcuts, shown in the shortcuts dialog. */
export interface ShortcutDefinition {
  id: string;
  combo: string;
  description: string;
  group: 'General' | 'Navigation' | 'Command palette';
}

export const SHORTCUTS = {
  commandPalette: {
    id: 'commandPalette',
    combo: 'mod+k',
    description: 'Open command palette / global search',
    group: 'General',
  },
  toggleSidebar: {
    id: 'toggleSidebar',
    combo: 'mod+b',
    description: 'Collapse or expand sidebar',
    group: 'General',
  },
  toggleTheme: {
    id: 'toggleTheme',
    combo: 'mod+shift+l',
    description: 'Cycle theme (light → dark → system)',
    group: 'General',
  },
  shortcutsHelp: {
    id: 'shortcutsHelp',
    combo: '?',
    description: 'Show keyboard shortcuts',
    group: 'General',
  },
  goDashboard: {
    id: 'goDashboard',
    combo: 'alt+0',
    description: 'Go to dashboard',
    group: 'Navigation',
  },
  quickAccess: {
    id: 'quickAccess',
    combo: 'alt+1',
    description: 'Open quick-access tool 1–9 (Alt+1 … Alt+9)',
    group: 'Navigation',
  },
  paletteNavigate: {
    id: 'paletteNavigate',
    combo: 'arrowdown',
    description: 'Move selection (↑ / ↓)',
    group: 'Command palette',
  },
  paletteOpen: {
    id: 'paletteOpen',
    combo: 'enter',
    description: 'Open selected result',
    group: 'Command palette',
  },
  paletteActions: {
    id: 'paletteActions',
    combo: '>',
    description: 'Type ">" to show actions only',
    group: 'Command palette',
  },
} as const satisfies Record<string, ShortcutDefinition>;

export const SHORTCUT_LIST: readonly ShortcutDefinition[] = Object.values(SHORTCUTS);
