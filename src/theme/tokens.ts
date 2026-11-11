/** Design tokens shared by the MUI theme, charts and (later) Monaco themes. */
export const fontFamilies = {
  sans: '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export const radii = { sm: 6, md: 10, lg: 14 } as const;

export const layout = {
  sidebarWidth: 256,
  sidebarCollapsedWidth: 68,
  topBarHeight: 56,
  contentMaxWidth: 1440,
} as const;

export interface ColorTokens {
  primary: string;
  primaryContrast: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  /** Categorical chart palette. */
  chart: readonly string[];
}

export const lightColors: ColorTokens = {
  primary: '#4f46e5',
  primaryContrast: '#ffffff',
  secondary: '#0891b2',
  background: '#f6f7f9',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceSunken: '#eef0f4',
  border: '#e3e6ec',
  borderStrong: '#cfd4dd',
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  textMuted: '#6b7280',
  success: '#15803d',
  warning: '#b45309',
  error: '#dc2626',
  info: '#2563eb',
  chart: ['#4f46e5', '#0891b2', '#d97706', '#db2777', '#059669', '#7c3aed', '#64748b', '#ea580c'],
};

export const darkColors: ColorTokens = {
  primary: '#818cf8',
  primaryContrast: '#0b0f17',
  secondary: '#22d3ee',
  background: '#0b0f17',
  surface: '#111622',
  surfaceRaised: '#161c2b',
  surfaceSunken: '#0d121c',
  border: '#232a3a',
  borderStrong: '#323b4f',
  textPrimary: '#e6e9f0',
  textSecondary: '#a3acbf',
  textMuted: '#8690a5',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',
  chart: ['#818cf8', '#22d3ee', '#fbbf24', '#f472b6', '#34d399', '#a78bfa', '#94a3b8', '#fb923c'],
};
