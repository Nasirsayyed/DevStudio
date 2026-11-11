import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router';

/**
 * Honest status panel for functionality that is part of the roadmap but not
 * yet implemented. No fake controls are rendered.
 */
export function ScheduledNotice({ phase, what }: { phase: number; what: string }) {
  return (
    <Alert
      severity="info"
      variant="outlined"
      sx={{ borderRadius: 3, alignItems: 'flex-start' }}
      action={
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/" size="small" color="inherit">
            Dashboard
          </Button>
        </Stack>
      }
    >
      <AlertTitle>Scheduled for Phase {phase}</AlertTitle>
      {what} is part of the DevStudio roadmap and will be delivered in Phase {phase}. You can
      already add it to your favorites and quick access.
    </Alert>
  );
}
