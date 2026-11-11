import { Box, Chip, IconButton, Stack, Tooltip, Typography, alpha } from '@mui/material';
import type { Icon } from 'iconsax-reactjs';
import { Star1 } from 'iconsax-reactjs';
import type { ReactNode } from 'react';

export interface ToolHeaderProps {
  title: string;
  description?: string;
  icon?: Icon;
  /** Small status chip, e.g. "Phase 4". */
  badge?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** Contextual actions rendered on the right. */
  actions?: ReactNode;
}

export function ToolHeader({
  title,
  description,
  icon: IconComponent,
  badge,
  isFavorite,
  onToggleFavorite,
  actions,
}: ToolHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        mb: 3,
      }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
        {IconComponent && (
          <Box
            aria-hidden
            sx={(t) => ({
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              borderRadius: 2.5,
              color: 'primary.main',
              bgcolor: alpha(t.palette.primary.main, 0.12),
            })}
          >
            <IconComponent size={24} variant="Bulk" color="currentColor" />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="h3" component="h1" noWrap>
              {title}
            </Typography>
            {badge && <Chip size="small" label={badge} variant="outlined" />}
            {onToggleFavorite && (
              <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                <IconButton
                  size="small"
                  onClick={onToggleFavorite}
                  aria-pressed={isFavorite}
                  aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  sx={{ color: isFavorite ? 'warning.main' : 'text.secondary' }}
                >
                  <Star1 size={20} variant={isFavorite ? 'Bold' : 'Linear'} color="currentColor" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>
      </Stack>
      {actions && (
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
