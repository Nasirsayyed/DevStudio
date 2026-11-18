import { createContext, useContext } from 'react';

export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error';

export interface NotificationOptions {
  severity?: NotificationSeverity;
  /** Milliseconds; null keeps the toast until dismissed. Default 4000 (errors 7000). */
  durationMs?: number | null;
  action?: { label: string; onClick: () => void };
}

export interface NotifyApi {
  notify: (message: string, options?: NotificationOptions) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
}

export const NotificationContext = createContext<NotifyApi | null>(null);

export function useNotify(): NotifyApi {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotify must be used within <NotificationProvider>');
  return ctx;
}
