import { Box, Card, CardActionArea, Skeleton, Stack, Typography, alpha } from '@mui/material';
import type { Icon } from 'iconsax-reactjs';
import { Link as RouterLink } from 'react-router';
import { formatCount } from '@/core/format/bytes';

export interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: Icon;
  to: string;
  hint?: string;
  colorIndex?: number;
}

export function StatCard({
  label,
  value,
  icon: IconComponent,
  to,
  hint,
  colorIndex = 0,
}: StatCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea
        component={RouterLink}
        to={to}
        sx={{ p: 2, height: '100%' }}
        aria-label={`${label}: ${value ?? 'loading'}`}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            aria-hidden
            sx={(t) => {
              const color =
                t.tokens.chart[colorIndex % t.tokens.chart.length] ?? t.palette.primary.main;
              return {
                display: 'grid',
                placeItems: 'center',
                width: 40,
                height: 40,
                borderRadius: 2.5,
                color,
                bgcolor: alpha(color, 0.12),
                flexShrink: 0,
              };
            }}
          >
            <IconComponent size={22} variant="Bulk" color="currentColor" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap component="p">
              {label}
            </Typography>
            {value === undefined ? (
              <Skeleton width={40} height={30} />
            ) : (
              <Typography variant="h3" component="p" sx={{ lineHeight: 1.2 }}>
                {formatCount(value)}
              </Typography>
            )}
            {hint && (
              <Typography variant="caption" color="text.secondary" noWrap component="p">
                {hint}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
