import { Box, Stack, Typography } from '@mui/material';
import type { Icon } from 'iconsax-reactjs';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: Icon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Compact variant for use inside cards. */
  dense?: boolean;
}

export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  dense = false,
}: EmptyStateProps) {
  return (
    <Stack
      spacing={dense ? 1 : 1.5}
      sx={{
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: dense ? 3 : 8,
        px: 2,
        color: 'text.secondary',
      }}
    >
      {IconComponent && (
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: dense ? 40 : 56,
            height: dense ? 40 : 56,
            borderRadius: '50%',
            bgcolor: 'background.sunken',
            color: 'text.secondary',
          }}
          aria-hidden
        >
          <IconComponent size={dense ? 20 : 26} variant="Bulk" color="currentColor" />
        </Box>
      )}
      <Typography variant={dense ? 'subtitle2' : 'h5'} color="text.primary" component="p">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 420 }} component="div">
          {description}
        </Typography>
      )}
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}
