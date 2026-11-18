import { Box, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export interface PanelProps {
  title: string;
  /** Small inline content next to the title (chips, status). */
  meta?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  children: ReactNode;
  /** Accessible region name; defaults to the title. */
  ariaLabel?: string;
}

/** Bordered work area with a header (title, meta, actions), body and optional footer. */
export function Panel({
  title,
  meta,
  actions,
  footer,
  busy = false,
  children,
  ariaLabel,
}: PanelProps) {
  return (
    <Paper
      variant="outlined"
      component="section"
      aria-label={ariaLabel ?? title}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        borderRadius: 2.5,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          px: 1.5,
          minHeight: 44,
          borderBottom: 1,
          borderColor: 'divider',
          flexWrap: 'wrap',
          rowGap: 0.5,
        }}
      >
        <Typography variant="subtitle2" component="h2" noWrap>
          {title}
        </Typography>
        {meta}
        <Box sx={{ flex: 1 }} />
        {actions && (
          <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
            {actions}
          </Stack>
        )}
      </Stack>
      <Box sx={{ height: 2 }}>
        {busy && <LinearProgress aria-label={`${title}: processing`} sx={{ height: 2 }} />}
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {children}
      </Box>
      {footer && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: 'center',
            px: 1.5,
            py: 0.5,
            borderTop: 1,
            borderColor: 'divider',
            minHeight: 32,
            flexWrap: 'wrap',
          }}
        >
          {footer}
        </Stack>
      )}
    </Paper>
  );
}
