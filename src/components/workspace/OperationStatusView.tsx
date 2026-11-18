import { Alert, Box, Button } from '@mui/material';
import { Flash } from 'iconsax-reactjs';
import type { ReactNode } from 'react';
import { EmptyState, Kbd } from '@/components';
import { ParseError, ValidationError, toUserMessage } from '@/core/errors/AppError';
import type { OperationState } from '@/hooks/useTaskOperation';

/**
 * Renders idle / manual-run / error states for custom result views, or the
 * children when a result is available.
 */
export function OperationStatusView<T>({
  state,
  emptyHint,
  children,
  queryErrorHint,
}: {
  state: OperationState<T>;
  emptyHint: string;
  children: (result: T) => ReactNode;
  /** When set, ValidationErrors are already shown next to the query field; show this hint instead. */
  queryErrorHint?: string;
}) {
  if (state.status === 'error' && state.error instanceof ValidationError && queryErrorHint) {
    return <EmptyState dense title="Check your query" description={queryErrorHint} />;
  }
  if (state.status === 'error' && state.error) {
    return (
      <Alert severity="error" variant="outlined" sx={{ m: 1.5, borderRadius: 2 }} role="alert">
        {state.error instanceof ParseError ? 'Fix the input to see the result. ' : ''}
        {toUserMessage(state.error)}
      </Alert>
    );
  }
  if (state.result !== undefined) return <>{children(state.result)}</>;
  if (!state.autoRun && state.stale) {
    return (
      <EmptyState
        dense
        icon={Flash}
        title="Large input"
        description={
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              gap: 0.75,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            Large documents are processed on demand, in the background. Press
            <Kbd combo="mod+enter" size="small" /> in the editor, or:
          </Box>
        }
        action={
          <Button
            variant="contained"
            startIcon={<Flash size={16} color="currentColor" />}
            onClick={state.run}
          >
            Run
          </Button>
        }
      />
    );
  }
  return <EmptyState dense title="Nothing to show yet" description={emptyHint} />;
}
