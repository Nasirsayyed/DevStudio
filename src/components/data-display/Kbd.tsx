import { Box, Stack } from '@mui/material';
import { formatHotkey } from '@/core/keyboard/hotkeys';
import { IS_APPLE } from '@/hooks/usePlatform';

/** Renders a keyboard combination like "mod+k" as styled keys. */
export function Kbd({ combo, size = 'medium' }: { combo: string; size?: 'small' | 'medium' }) {
  const keys = formatHotkey(combo, IS_APPLE);
  return (
    <Stack direction="row" spacing={0.5} component="span" aria-label={keys.join(' + ')}>
      {keys.map((k) => (
        <Box
          key={k}
          component="kbd"
          sx={{
            px: size === 'small' ? 0.5 : 0.75,
            minWidth: size === 'small' ? 18 : 22,
            height: size === 'small' ? 18 : 22,
            display: 'inline-grid',
            placeItems: 'center',
            fontSize: size === 'small' ? 10.5 : 11.5,
            fontWeight: 600,
            lineHeight: 1,
            color: 'text.secondary',
            bgcolor: 'background.sunken',
            border: 1,
            borderColor: 'divider',
            borderBottomWidth: 2,
            borderRadius: 1,
          }}
        >
          {k}
        </Box>
      ))}
    </Stack>
  );
}
