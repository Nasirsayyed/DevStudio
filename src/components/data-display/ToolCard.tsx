import { Box, Card, CardActionArea, Chip, Stack, Typography, alpha } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { toolPath } from '@/tools/toolRegistry';
import { isToolAvailable } from '@/tools/toolPages';
import { ToolIcon } from './ToolIcon';
import type { ToolDefinition } from '@/types/tools';

export interface ToolCardProps {
  tool: ToolDefinition;
  /** Hide the description for compact grids. */
  compact?: boolean;
}

/** Link card for a tool. Shows its roadmap phase when it isn't implemented yet. */
export function ToolCard({ tool, compact = false }: ToolCardProps) {
  const available = isToolAvailable(tool.aliasOf ?? tool.id);
  return (
    <Card
      sx={{
        height: '100%',
        transition: 'border-color 120ms, transform 120ms',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <CardActionArea
        component={RouterLink}
        to={toolPath(tool)}
        sx={{ height: '100%', p: compact ? 1.5 : 2 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: compact ? 'center' : 'flex-start' }}>
          <Box
            aria-hidden
            sx={(t) => ({
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              width: compact ? 32 : 36,
              height: compact ? 32 : 36,
              borderRadius: 2,
              color: 'primary.main',
              bgcolor: alpha(t.palette.primary.main, 0.1),
            })}
          >
            <ToolIcon tool={tool} size={compact ? 18 : 20} variant="Bulk" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Typography variant="subtitle2" noWrap component="span">
                {tool.title}
              </Typography>
              {!available && !compact && (
                <Chip
                  size="small"
                  label={`Phase ${tool.phase}`}
                  sx={{ height: 20, fontSize: 10.5 }}
                />
              )}
            </Stack>
            {!compact && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  mt: 0.25,
                }}
              >
                {tool.description}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
