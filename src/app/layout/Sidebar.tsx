import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ArrowLeft2, ArrowRight2 } from 'iconsax-reactjs';
import { memo } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useUiStore } from '@/stores/uiStore';
import { layout } from '@/theme/tokens';
import { MODULES, findModuleByPath } from '@/tools/modules';
import type { ModuleDefinition } from '@/types/tools';
import { BrandMark } from './BrandMark';

const SECTION_LABELS: Record<ModuleDefinition['section'], string | null> = {
  main: 'Tools',
  workspace: 'Workspace',
  system: null,
};

const SECTIONS: ModuleDefinition['section'][] = ['main', 'workspace', 'system'];

interface NavListProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

const NavList = memo(function NavList({ collapsed, onNavigate }: NavListProps) {
  const { pathname } = useLocation();
  const activeId = findModuleByPath(pathname)?.id;

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: 1.25, py: 1 }}
    >
      {SECTIONS.map((section, sectionIndex) => {
        const label = SECTION_LABELS[section];
        const items = MODULES.filter((m) => m.section === section);
        return (
          <List
            key={section}
            dense
            disablePadding
            sx={{ mb: 1 }}
            subheader={
              label && !collapsed ? (
                <ListSubheader
                  disableSticky
                  sx={{
                    bgcolor: 'transparent',
                    lineHeight: '28px',
                    px: 1.25,
                    typography: 'overline',
                    color: 'text.secondary',
                  }}
                >
                  {label}
                </ListSubheader>
              ) : sectionIndex > 0 ? (
                <Divider sx={{ my: 1 }} />
              ) : undefined
            }
          >
            {items.map((mod) => {
              const selected = mod.id === activeId;
              const IconComponent = mod.icon;
              const button = (
                <ListItemButton
                  component={RouterLink}
                  to={mod.path}
                  selected={selected}
                  aria-current={selected ? 'page' : undefined}
                  onClick={onNavigate}
                  sx={{
                    minHeight: 40,
                    mb: 0.25,
                    px: 1.25,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 36,
                      color: selected ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    <IconComponent
                      size={20}
                      variant={selected ? 'Bulk' : 'Linear'}
                      color="currentColor"
                    />
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={mod.title}
                      slotProps={{
                        primary: {
                          noWrap: true,
                          sx: { fontSize: 13.5, fontWeight: selected ? 650 : 500 },
                        },
                      }}
                    />
                  )}
                </ListItemButton>
              );
              return (
                <li key={mod.id}>
                  {collapsed ? (
                    <Tooltip title={mod.title} placement="right">
                      {button}
                    </Tooltip>
                  ) : (
                    button
                  )}
                </li>
              );
            })}
          </List>
        );
      })}
    </Box>
  );
});

function SidebarContent({
  collapsed,
  onNavigate,
  showCollapseToggle,
}: NavListProps & { showCollapseToggle: boolean }) {
  const toggleSidebarCollapsed = usePreferencesStore((s) => s.toggleSidebarCollapsed);
  return (
    <Stack sx={{ height: '100%' }}>
      <Stack
        direction="row"
        spacing={1.25}
        component={RouterLink}
        to="/"
        onClick={onNavigate}
        aria-label="DevStudio home"
        sx={{
          alignItems: 'center',
          height: layout.topBarHeight,
          px: collapsed ? 0 : 2.25,
          justifyContent: collapsed ? 'center' : 'flex-start',
          color: 'text.primary',
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <BrandMark size={28} />
        {!collapsed && (
          <Typography
            variant="h6"
            component="span"
            sx={{ fontWeight: 750, letterSpacing: '-0.02em' }}
          >
            DevStudio
          </Typography>
        )}
      </Stack>
      <Divider />
      <NavList collapsed={collapsed} onNavigate={onNavigate} />
      {showCollapseToggle && (
        <>
          <Divider />
          <Stack direction="row" sx={{ justifyContent: collapsed ? 'center' : 'flex-end', p: 1 }}>
            <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
              <IconButton
                size="small"
                onClick={toggleSidebarCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
              >
                {collapsed ? (
                  <ArrowRight2 size={18} color="currentColor" />
                ) : (
                  <ArrowLeft2 size={18} color="currentColor" />
                )}
              </IconButton>
            </Tooltip>
          </Stack>
        </>
      )}
    </Stack>
  );
}

/**
 * Responsive application sidebar:
 * - md and up: permanent drawer, collapsible to an icon rail (persisted).
 * - below md: temporary drawer opened from the top bar.
 */
export function Sidebar() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const collapsed = usePreferencesStore((s) => s.sidebarCollapsed);
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);

  if (!isDesktop) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => {
          setMobileOpen(false);
        }}
        ModalProps={{ keepMounted: true }}
        slotProps={{ paper: { sx: { width: layout.sidebarWidth, bgcolor: 'background.paper' } } }}
      >
        <SidebarContent
          collapsed={false}
          showCollapseToggle={false}
          onNavigate={() => {
            setMobileOpen(false);
          }}
        />
      </Drawer>
    );
  }

  const width = collapsed ? layout.sidebarCollapsedWidth : layout.sidebarWidth;
  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        transition: theme.transitions.create('width', {
          duration: theme.transitions.duration.shorter,
        }),
        '& .MuiDrawer-paper': {
          width,
          overflowX: 'hidden',
          boxSizing: 'border-box',
          bgcolor: 'background.paper',
          borderRightColor: 'divider',
          transition: theme.transitions.create('width', {
            duration: theme.transitions.duration.shorter,
          }),
        },
      }}
    >
      <SidebarContent collapsed={collapsed} showCollapseToggle />
    </Drawer>
  );
}
