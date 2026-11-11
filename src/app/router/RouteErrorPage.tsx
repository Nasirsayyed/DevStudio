import { Alert, AlertTitle, Box, Button, Stack } from '@mui/material';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { toUserMessage } from '@/core/errors/AppError';

/** Last-resort error screen for errors thrown outside the layout's error boundary. */
export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : toUserMessage(error);
  return (
    <Box sx={{ p: 4, maxWidth: 720, mx: 'auto' }}>
      <Alert severity="error" variant="outlined">
        <AlertTitle>DevStudio hit an unexpected error</AlertTitle>
        {message}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              window.location.assign('/');
            }}
          >
            Reload DevStudio
          </Button>
        </Stack>
      </Alert>
    </Box>
  );
}
