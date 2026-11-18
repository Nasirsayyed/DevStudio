import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { type Icon, Monitor, Moon, Sun1, TickCircle } from 'iconsax-reactjs';
import { useState } from 'react';
import type { ThemeMode } from '@/services/preferences/preferences';
import { usePreferencesStore } from '@/stores/preferencesStore';

const OPTIONS: { mode: ThemeMode; label: string; icon: Icon }[] = [
  { mode: 'light', label: 'Light', icon: Sun1 },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'System', icon: Monitor },
];

export function ThemeMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const Current = OPTIONS.find((o) => o.mode === themeMode)?.icon ?? Monitor;

  return (
    <>
      <Tooltip title="Theme">
        <IconButton
          aria-label={`Theme: ${themeMode}`}
          aria-haspopup="menu"
          aria-controls={anchor ? 'theme-menu' : undefined}
          aria-expanded={anchor ? true : undefined}
          onClick={(e) => {
            setAnchor(e.currentTarget);
          }}
        >
          <Current size={20} color="currentColor" />
        </IconButton>
      </Tooltip>
      <Menu
        id="theme-menu"
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {OPTIONS.map(({ mode, label, icon: IconComponent }) => (
          <MenuItem
            key={mode}
            selected={mode === themeMode}
            onClick={() => {
              setThemeMode(mode);
              setAnchor(null);
            }}
            sx={{ minWidth: 180 }}
          >
            <ListItemIcon>
              <IconComponent size={18} color="currentColor" />
            </ListItemIcon>
            <ListItemText primary={label} />
            {mode === themeMode && <TickCircle size={16} color="currentColor" variant="Bold" />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
