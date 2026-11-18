import { create } from 'zustand';

/** Ephemeral UI state (never persisted). */
interface UiState {
  commandPaletteOpen: boolean;
  /** Optional query to prefill when the palette opens (e.g. ">" for actions). */
  commandPaletteInitialQuery: string;
  shortcutsDialogOpen: boolean;
  mobileNavOpen: boolean;
  openCommandPalette: (initialQuery?: string) => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  setShortcutsDialogOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  commandPaletteOpen: false,
  commandPaletteInitialQuery: '',
  shortcutsDialogOpen: false,
  mobileNavOpen: false,
  openCommandPalette: (initialQuery = '') =>
    set({
      commandPaletteOpen: true,
      commandPaletteInitialQuery: initialQuery,
      shortcutsDialogOpen: false,
    }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen, commandPaletteInitialQuery: '' })),
  setShortcutsDialogOpen: (shortcutsDialogOpen) => set({ shortcutsDialogOpen }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}));
