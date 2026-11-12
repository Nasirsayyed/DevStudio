import { LinearProgress, Stack, Typography } from '@mui/material';
import type { Strength } from '@/core/generators/password';

const COLORS = ['error', 'error', 'warning', 'success', 'success'] as const;

export function StrengthMeter({ strength }: { strength: Strength }) {
  return (
    <Stack spacing={0.5} sx={{ minWidth: 220 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {strength.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ≈ {strength.bits} bits of entropy
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={((strength.score + 1) / 5) * 100}
        color={COLORS[strength.score]}
        aria-label={`Strength: ${strength.label}, about ${strength.bits} bits`}
        sx={{ height: 6, borderRadius: 3 }}
      />
    </Stack>
  );
}
