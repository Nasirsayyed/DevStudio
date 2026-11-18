import { Box } from '@mui/material';
import { Suspense, lazy } from 'react';
import { Outlet, useLocation } from 'react-router';
import { ErrorBoundary, LoadingState } from '@/components';
import { useUiStore } from '@/stores/uiStore';
import { GlobalShortcuts } from '../GlobalShortcuts';
import { ShortcutsDialog } from './ShortcutsDialog';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

// The palette is only needed once opened; keep it out of the initial bundle.
const CommandPalette = lazy(() => import('../command-palette/CommandPalette'));

function LazyCommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette />
    </Suspense>
  );
}

export function AppLayout() {
  const { pathname } = useLocation();
  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{ flex: 1, minWidth: 0, outline: 'none' }}
        >
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<LoadingState label="Loading module…" minHeight={400} />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </Box>
      </Box>
      <GlobalShortcuts />
      <ShortcutsDialog />
      <LazyCommandPalette />
    </Box>
  );
}
