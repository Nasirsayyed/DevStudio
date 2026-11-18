import { Box } from '@mui/material';

/** DevStudio logo mark (inline SVG, no external asset). */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }} aria-hidden>
      <svg width={size} height={size} viewBox="0 0 64 64" focusable="false">
        <defs>
          <linearGradient id="ds-brand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#ds-brand)" />
        <path
          d="M24 22 14 32l10 10M40 22l10 10-10 10M35 18l-6 28"
          fill="none"
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
}
