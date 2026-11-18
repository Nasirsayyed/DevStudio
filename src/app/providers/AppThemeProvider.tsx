import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { type ReactNode, useEffect, useMemo } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { createAppTheme } from '@/theme/createAppTheme';

/** Resolves the theme mode ("system" follows the OS) and provides the MUI theme. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const resolved = themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode;
  const theme = useMemo(() => createAppTheme(resolved), [resolved]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
