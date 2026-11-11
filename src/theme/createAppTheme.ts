import { type PaletteMode, alpha, createTheme } from '@mui/material/styles';
import { type ColorTokens, darkColors, fontFamilies, lightColors, radii } from './tokens';

declare module '@mui/material/styles' {
  interface Theme {
    tokens: ColorTokens;
  }
  interface ThemeOptions {
    tokens?: ColorTokens;
  }
  interface TypeBackground {
    sunken: string;
    raised: string;
  }
}

export function getColorTokens(mode: PaletteMode): ColorTokens {
  return mode === 'dark' ? darkColors : lightColors;
}

export function createAppTheme(mode: PaletteMode) {
  const c = getColorTokens(mode);
  const focusRing = `0 0 0 3px ${alpha(c.primary, 0.35)}`;

  return createTheme({
    tokens: c,
    palette: {
      mode,
      primary: { main: c.primary, contrastText: c.primaryContrast },
      secondary: { main: c.secondary },
      success: { main: c.success },
      warning: { main: c.warning },
      error: { main: c.error },
      info: { main: c.info },
      background: {
        default: c.background,
        paper: c.surface,
        sunken: c.surfaceSunken,
        raised: c.surfaceRaised,
      },
      text: { primary: c.textPrimary, secondary: c.textSecondary, disabled: c.textMuted },
      divider: c.border,
    },
    shape: { borderRadius: radii.md },
    typography: {
      fontFamily: fontFamilies.sans,
      fontSize: 14,
      h1: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontSize: '1.375rem', fontWeight: 650, letterSpacing: '-0.015em' },
      h4: { fontSize: '1.125rem', fontWeight: 650, letterSpacing: '-0.01em' },
      h5: { fontSize: '1rem', fontWeight: 650 },
      h6: { fontSize: '0.9375rem', fontWeight: 650 },
      subtitle1: { fontWeight: 550 },
      subtitle2: { fontWeight: 600, fontSize: '0.8125rem' },
      body2: { fontSize: '0.8125rem' },
      caption: { fontSize: '0.75rem' },
      overline: { fontSize: '0.6875rem', fontWeight: 650, letterSpacing: '0.08em' },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { colorScheme: mode },
          body: { backgroundColor: c.background, WebkitFontSmoothing: 'antialiased' },
          'code, kbd, pre, samp': { fontFamily: fontFamilies.mono },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: c.borderStrong,
            borderRadius: 8,
            border: `2px solid ${c.background}`,
          },
          '*::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              transitionDuration: '0.01ms !important',
            },
          },
        },
      },
      MuiButtonBase: { defaultProps: { disableRipple: false } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: radii.sm, '&.Mui-focusVisible': { boxShadow: focusRing } },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: radii.sm, '&.Mui-focusVisible': { boxShadow: focusRing } },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { borderRadius: radii.lg, borderColor: c.border } },
      },
      MuiCardActionArea: {
        styleOverrides: { focusHighlight: { borderRadius: radii.lg } },
      },
      MuiTooltip: {
        defaultProps: { arrow: true, enterDelay: 400 },
        styleOverrides: { tooltip: { fontSize: '0.75rem', fontWeight: 500 } },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: radii.sm } } },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: radii.sm,
            '&.Mui-selected': {
              backgroundColor: alpha(c.primary, mode === 'dark' ? 0.16 : 0.1),
              color: c.primary,
              '&:hover': { backgroundColor: alpha(c.primary, mode === 'dark' ? 0.22 : 0.14) },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: radii.lg, border: `1px solid ${c.border}` } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: radii.sm, backgroundColor: c.surface },
          notchedOutline: { borderColor: c.border },
        },
      },
      MuiMenu: {
        styleOverrides: { paper: { border: `1px solid ${c.border}`, marginTop: 4 } },
      },
      MuiAppBar: { defaultProps: { elevation: 0, color: 'inherit' } },
      MuiLink: { defaultProps: { underline: 'hover' } },
    },
  });
}
