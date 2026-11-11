import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Removes inner padding for edge-to-edge lists. */
  flush?: boolean;
  id?: string;
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  flush = false,
  id,
}: SectionCardProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <Card
      component="section"
      aria-labelledby={headingId}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          pt: 2,
          pb: flush ? 1 : 0,
        }}
      >
        <div>
          <Typography variant="h6" component="h2" id={headingId}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </div>
        {action}
      </Stack>
      <CardContent sx={{ flex: 1, ...(flush ? { p: 0, '&:last-child': { pb: 1 } } : {}) }}>
        {children}
      </CardContent>
    </Card>
  );
}
