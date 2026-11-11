import { List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { ToolIcon } from '@/components';
import { Link as RouterLink } from 'react-router';
import { getToolModule, toolPath } from '@/tools/toolRegistry';
import type { ToolDefinition } from '@/types/tools';

export function ToolList({
  tools,
  ariaLabel,
}: {
  tools: readonly ToolDefinition[];
  ariaLabel: string;
}) {
  return (
    <List dense disablePadding aria-label={ariaLabel}>
      {tools.map((tool) => {
        return (
          <li key={tool.id}>
            <ListItemButton component={RouterLink} to={toolPath(tool)} sx={{ mx: 1 }}>
              <ListItemIcon sx={{ minWidth: 34, color: 'text.secondary' }}>
                <ToolIcon tool={tool} size={18} />
              </ListItemIcon>
              <ListItemText
                primary={tool.title}
                secondary={getToolModule(tool).title}
                slotProps={{
                  primary: { noWrap: true, sx: { fontSize: 13.5, fontWeight: 550 } },
                  secondary: { sx: { fontSize: 11.5 } },
                }}
              />
            </ListItemButton>
          </li>
        );
      })}
    </List>
  );
}
