import { Alert, AlertTitle, Box, Button, Stack } from '@mui/material';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { toUserMessage } from '@/core/errors/AppError';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** When this value changes the boundary resets (e.g. pass the route path). */
  resetKey?: unknown;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: unknown;
}

/** Catches render errors in a subtree and shows a recoverable error panel. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          variant="outlined"
          action={
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" onClick={this.reset}>
                Try again
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${error.name}: ${error.message}\n${error.stack ?? ''}`,
                  );
                }}
              >
                Copy details
              </Button>
            </Stack>
          }
        >
          <AlertTitle>This view crashed</AlertTitle>
          {toUserMessage(error)}
        </Alert>
      </Box>
    );
  }
}
