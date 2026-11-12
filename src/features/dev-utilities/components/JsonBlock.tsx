import { Box, Stack, Typography } from '@mui/material';
import { CopyButton } from '@/components';
import { formatJson } from '@/core/json/format';
import type { JsonValue } from '@/core/json/types';
import { fontFamilies } from '@/theme/tokens';

/** Read-only pretty JSON with a copy button (lightweight; no editor needed). */
export function JsonBlock({
  title,
  value,
  color,
}: {
  title: string;
  value: JsonValue;
  color?: string;
}) {
  const text = formatJson(value);
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        borderLeft: color ? 4 : 1,
        borderLeftColor: color,
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'center', px: 1.5, py: 0.5, bgcolor: 'background.sunken' }}
      >
        <Typography variant="subtitle2" component="h3" sx={{ flex: 1 }}>
          {title}
        </Typography>
        <CopyButton value={text} label={`Copy ${title.toLowerCase()}`} />
      </Stack>
      <Box
        component="pre"
        aria-label={title}
        sx={{
          m: 0,
          p: 1.5,
          fontFamily: fontFamilies.mono,
          fontSize: 13,
          overflowX: 'auto',
          maxHeight: 360,
        }}
      >
        {text}
      </Box>
    </Box>
  );
}
