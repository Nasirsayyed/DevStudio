const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Formats a byte count using 1024-based units, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(fractionDigits).replace(/\.0+$/, '')} ${UNITS[unit] ?? 'B'}`;
}

/** Compact integer formatting: 1234 → "1.2k". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
