import { Alert, Button, Snackbar } from '@mui/material';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import {
  NotificationContext,
  type NotificationOptions,
  type NotificationSeverity,
  type NotifyApi,
} from './notificationContext';

interface QueuedNotification {
  id: number;
  message: string;
  severity: NotificationSeverity;
  durationMs: number | null;
  action: NotificationOptions['action'];
}

const MAX_QUEUE = 5;
let nextId = 1;

/** App-wide toast queue: one visible at a time, newest queued last. */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedNotification[]>([]);
  // While a toast animates out it must not be re-opened by newer notifications.
  const [closing, setClosing] = useState(false);
  const current = queue[0];

  const notify = useCallback((message: string, options: NotificationOptions = {}) => {
    const severity = options.severity ?? 'info';
    const item: QueuedNotification = {
      id: nextId++,
      message,
      severity,
      durationMs:
        options.durationMs === undefined
          ? severity === 'error'
            ? 7000
            : 4000
          : options.durationMs,
      action: options.action,
    };
    setQueue((q) => [...q, item].slice(-MAX_QUEUE));
  }, []);

  const api = useMemo<NotifyApi>(
    () => ({
      notify,
      success: (m) => notify(m, { severity: 'success' }),
      info: (m) => notify(m, { severity: 'info' }),
      warning: (m) => notify(m, { severity: 'warning' }),
      error: (m) => notify(m, { severity: 'error' }),
    }),
    [notify],
  );

  const handleClose = (_: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setClosing(true);
  };

  const handleExited = () => {
    setQueue((q) => q.slice(1));
    setClosing(false);
  };

  return (
    <NotificationContext.Provider value={api}>
      {children}
      {current && (
        <Snackbar
          key={current.id}
          open={!closing}
          autoHideDuration={current.durationMs}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          slotProps={{ transition: { onExited: handleExited } }}
        >
          <Alert
            severity={current.severity}
            variant="filled"
            onClose={() => {
              setClosing(true);
            }}
            action={
              current.action ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    current.action?.onClick();
                    setClosing(true);
                  }}
                >
                  {current.action.label}
                </Button>
              ) : undefined
            }
            sx={{ minWidth: 280, alignItems: 'center' }}
          >
            {current.message}
          </Alert>
        </Snackbar>
      )}
    </NotificationContext.Provider>
  );
}
