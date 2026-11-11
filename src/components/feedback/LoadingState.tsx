import { CircularProgress, Stack, Typography } from '@mui/material';

export function LoadingState({
  label = 'Loading…',
  minHeight = 240,
}: {
  label?: string;
  minHeight?: number;
}) {
  return (
    <Stack
      spacing={2}
      sx={{ alignItems: 'center', justifyContent: 'center', minHeight }}
      role="status"
      aria-live="polite"
    >
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
