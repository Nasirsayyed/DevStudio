import {
  Box,
  Button,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ArrowDown2, Star1 } from 'iconsax-reactjs';
import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import { useFavoriteTools } from '@/hooks/useFavoriteTools';
import { layout } from '@/theme/tokens';
import { getToolsByModule, toolPath } from '@/tools/toolRegistry';
import type { ToolDefinition } from '@/types/tools';
import { ToolIcon } from '../data-display/ToolIcon';
import { ToolSidebar } from './ToolSidebar';

function ToolSwitcher({ tool }: { tool: ToolDefinition }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const tools = getToolsByModule(tool.moduleId).filter((t) => !t.aliasOf);
  return (
    <>
      <Button
        size="small"
        color="inherit"
        endIcon={<ArrowDown2 size={14} color="currentColor" />}
        onClick={(e) => {
          setAnchor(e.currentTarget);
        }}
        aria-haspopup="menu"
        aria-label="Switch tool"
      >
        Tools
      </Button>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null);
        }}
        slotProps={{ paper: { sx: { maxHeight: 420 } } }}
      >
        {tools.map((t) => (
          <MenuItem
            key={t.id}
            selected={t.id === tool.id}
            onClick={() => {
              setAnchor(null);
              void navigate(toolPath(t));
            }}
          >
            <ListItemIcon>
              <ToolIcon tool={t} size={16} />
            </ListItemIcon>
            {t.title}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export interface ToolWorkspaceProps {
  tool: ToolDefinition;
  /** Contextual actions (right side of the header). */
  actions?: ReactNode;
  /** Optional options bar rendered under the header. */
  toolbar?: ReactNode;
  children: ReactNode;
}

/**
 * Full-height layout for tool pages: module tool sidebar (lg+), compact
 * header with favorite toggle and actions, optional toolbar, and a body that
 * fills the remaining viewport height.
 */
export function ToolWorkspace({ tool, actions, toolbar, children }: ToolWorkspaceProps) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });
  const desktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const { isFavorite, toggle } = useFavoriteTools();
  const favorite = isFavorite(tool.id);

  return (
    <Box
      sx={{
        display: 'flex',
        height: desktop ? `calc(100dvh - ${layout.topBarHeight}px)` : 'auto',
        minHeight: 0,
      }}
    >
      {wide && <ToolSidebar moduleId={tool.moduleId} activeToolId={tool.id} />}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: 'center',
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            flexWrap: 'wrap',
            rowGap: 1,
          }}
        >
          <Box
            aria-hidden
            sx={(t) => ({
              display: 'grid',
              placeItems: 'center',
              width: 34,
              height: 34,
              borderRadius: 2,
              color: 'primary.main',
              bgcolor: alpha(t.palette.primary.main, 0.12),
              flexShrink: 0,
            })}
          >
            <ToolIcon tool={tool} size={20} variant="Bulk" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography variant="h5" component="h1" noWrap>
                {tool.title}
              </Typography>
              <Tooltip title={favorite ? 'Remove from favorites' : 'Add to favorites'}>
                <IconButton
                  size="small"
                  onClick={() => void toggle(tool.id)}
                  aria-pressed={favorite}
                  aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                  sx={{ color: favorite ? 'warning.main' : 'text.secondary' }}
                >
                  <Star1 size={18} variant={favorite ? 'Bold' : 'Linear'} color="currentColor" />
                </IconButton>
              </Tooltip>
              {!wide && <ToolSwitcher tool={tool} />}
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              component="p"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              {tool.description}
            </Typography>
          </Box>
          {actions && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              {actions}
            </Stack>
          )}
        </Stack>
        {toolbar && (
          <Box
            sx={{
              px: { xs: 2, sm: 2.5 },
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            {toolbar}
          </Box>
        )}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            p: { xs: 1.5, sm: 2 },
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
