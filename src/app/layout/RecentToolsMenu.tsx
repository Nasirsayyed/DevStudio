import {
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { Clock } from 'iconsax-reactjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ToolIcon } from '@/components';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { getToolModule, resolveTools, toolPath } from '@/tools/toolRegistry';

export function RecentToolsMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const recentIds = usePreferencesStore((s) => s.recentToolIds);
  const clearRecentTools = usePreferencesStore((s) => s.clearRecentTools);
  const tools = useMemo(() => resolveTools(recentIds), [recentIds]);
  const navigate = useNavigate();
  const close = () => {
    setAnchor(null);
  };

  return (
    <>
      <Tooltip title="Recent tools">
        <IconButton
          aria-label="Recent tools"
          aria-haspopup="menu"
          aria-expanded={anchor ? true : undefined}
          aria-controls={anchor ? 'recent-tools-menu' : undefined}
          onClick={(e) => {
            setAnchor(e.currentTarget);
          }}
        >
          <Clock size={20} color="currentColor" />
        </IconButton>
      </Tooltip>
      <Menu
        id="recent-tools-menu"
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 300 } } }}
      >
        <Typography variant="overline" color="text.secondary" sx={{ px: 2, display: 'block' }}>
          Recent tools
        </Typography>
        {tools.length === 0 && (
          <MenuItem disabled>
            <ListItemText primary="No tools opened yet" />
          </MenuItem>
        )}
        {tools.map((tool) => {
          return (
            <MenuItem
              key={tool.id}
              onClick={() => {
                close();
                void navigate(toolPath(tool));
              }}
            >
              <ListItemIcon>
                <ToolIcon tool={tool} size={18} />
              </ListItemIcon>
              <ListItemText
                primary={tool.title}
                secondary={getToolModule(tool).title}
                slotProps={{
                  primary: { noWrap: true, sx: { fontSize: 13.5 } },
                  secondary: { sx: { fontSize: 11.5 } },
                }}
              />
            </MenuItem>
          );
        })}
        {tools.length > 0 && <Divider />}
        {tools.length > 0 && (
          <MenuItem
            onClick={() => {
              clearRecentTools();
              close();
            }}
          >
            <ListItemText
              primary="Clear recent tools"
              slotProps={{ primary: { sx: { fontSize: 13, color: 'text.secondary' } } }}
            />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
