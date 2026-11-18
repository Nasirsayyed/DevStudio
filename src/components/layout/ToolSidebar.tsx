import { Box, List, ListItemButton, ListSubheader, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { getModule } from '@/tools/modules';
import { getToolsByModule, toolPath } from '@/tools/toolRegistry';
import type { ModuleId, ToolDefinition } from '@/types/tools';
import { ToolIcon } from '../data-display/ToolIcon';

function groupByName(tools: ToolDefinition[]): [string, ToolDefinition[]][] {
  const groups = new Map<string, ToolDefinition[]>();
  for (const t of tools) groups.set(t.group ?? '', [...(groups.get(t.group ?? '') ?? []), t]);
  return [...groups.entries()];
}

/** Secondary navigation listing the tools of a module. */
export function ToolSidebar({
  moduleId,
  activeToolId,
}: {
  moduleId: ModuleId;
  activeToolId: string;
}) {
  const mod = getModule(moduleId);
  const tools = getToolsByModule(moduleId).filter((t) => !t.aliasOf);
  return (
    <Box
      component="nav"
      aria-label={`${mod.title} tools`}
      sx={{
        width: 232,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        overflowY: 'auto',
        py: 1.5,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ px: 2.5, display: 'block' }}>
        {mod.title}
      </Typography>
      {groupByName(tools).map(([group, items]) => (
        <List
          key={group || 'all'}
          dense
          disablePadding
          subheader={
            group ? (
              <ListSubheader
                disableSticky
                sx={{ bgcolor: 'transparent', lineHeight: '28px', fontSize: 11, px: 2.5 }}
              >
                {group}
              </ListSubheader>
            ) : undefined
          }
        >
          {items.map((tool) => {
            const selected = tool.id === activeToolId;
            return (
              <li key={tool.id}>
                <ListItemButton
                  component={RouterLink}
                  to={toolPath(tool)}
                  selected={selected}
                  aria-current={selected ? 'page' : undefined}
                  sx={{ mx: 1, py: 0.5, gap: 1.25, minHeight: 34 }}
                >
                  <ToolIcon tool={tool} size={16} variant={selected ? 'Bulk' : 'Linear'} />
                  <Typography variant="body2" noWrap sx={{ fontWeight: selected ? 650 : 500 }}>
                    {tool.title}
                  </Typography>
                </ListItemButton>
              </li>
            );
          })}
        </List>
      ))}
    </Box>
  );
}
