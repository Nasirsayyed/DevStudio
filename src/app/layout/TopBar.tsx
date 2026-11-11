import {
  AppBar,
  Box,
  ButtonBase,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { HamburgerMenu, Keyboard, SearchNormal1, Setting2 } from 'iconsax-reactjs';
import { Link as RouterLink } from 'react-router';
import { Kbd } from '@/components';
import { useUiStore } from '@/stores/uiStore';
import { layout } from '@/theme/tokens';
import { SHORTCUTS } from '../shortcuts';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { RecentToolsMenu } from './RecentToolsMenu';
import { ThemeMenu } from './ThemeMenu';

/** Opens the command palette; looks like a search field. */
function GlobalSearchButton({ compact }: { compact: boolean }) {
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  if (compact) {
    return (
      <Tooltip title="Search">
        <IconButton
          aria-label="Open search"
          onClick={() => {
            openCommandPalette();
          }}
        >
          <SearchNormal1 size={20} color="currentColor" />
        </IconButton>
      </Tooltip>
    );
  }
  return (
    <ButtonBase
      onClick={() => {
        openCommandPalette();
      }}
      aria-label="Search tools and saved work"
      aria-keyshortcuts="Control+K Meta+K"
      sx={{
        width: { md: 260, lg: 340 },
        height: 36,
        px: 1.5,
        gap: 1,
        justifyContent: 'flex-start',
        borderRadius: 1.5,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.sunken',
        color: 'text.secondary',
        transition: 'border-color 120ms',
        '&:hover': { borderColor: 'text.secondary' },
        '&.Mui-focusVisible': { borderColor: 'primary.main' },
      }}
    >
      <SearchNormal1 size={16} color="currentColor" />
      <Typography variant="body2" sx={{ flex: 1, textAlign: 'left' }}>
        Search tools, requests, snippets…
      </Typography>
      <Kbd combo={SHORTCUTS.commandPalette.combo} size="small" />
    </ButtonBase>
  );
}

export function TopBar() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const setShortcutsDialogOpen = useUiStore((s) => s.setShortcutsDialogOpen);

  return (
    <AppBar
      position="sticky"
      sx={{
        top: 0,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: (t) =>
          t.palette.mode === 'dark' ? 'rgba(11,15,23,0.8)' : 'rgba(255,255,255,0.8)',
        backdropFilter: 'saturate(180%) blur(8px)',
      }}
    >
      <Toolbar
        sx={{ minHeight: `${layout.topBarHeight}px !important`, gap: 1, px: { xs: 1, sm: 2 } }}
      >
        {!isDesktop && (
          <IconButton
            aria-label="Open navigation"
            onClick={() => {
              setMobileNavOpen(true);
            }}
            edge="start"
          >
            <HamburgerMenu size={22} color="currentColor" />
          </IconButton>
        )}
        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center' }}>
          <AppBreadcrumbs />
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <GlobalSearchButton compact={!isDesktop} />
          <RecentToolsMenu />
          <ThemeMenu />
          {isDesktop && (
            <Tooltip title="Keyboard shortcuts (?)">
              <IconButton
                aria-label="Keyboard shortcuts"
                onClick={() => {
                  setShortcutsDialogOpen(true);
                }}
              >
                <Keyboard size={20} color="currentColor" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Settings">
            <IconButton component={RouterLink} to="/settings" aria-label="Settings">
              <Setting2 size={20} color="currentColor" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
