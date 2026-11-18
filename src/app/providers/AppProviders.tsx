import type { ReactNode } from 'react';
import { ConfirmationProvider, NotificationProvider } from '@/components';
import { AppThemeProvider } from './AppThemeProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppThemeProvider>
      <NotificationProvider>
        <ConfirmationProvider>{children}</ConfirmationProvider>
      </NotificationProvider>
    </AppThemeProvider>
  );
}
