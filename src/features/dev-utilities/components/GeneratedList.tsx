import { Button, Paper, Stack, Typography } from '@mui/material';
import { Refresh2 } from 'iconsax-reactjs';
import type { ReactNode } from 'react';
import { CopyButton } from '@/components';
import { DownloadButton } from '@/components/inputs/DownloadButton';
import { MonoTextField } from './MonoTextField';

/** Output of a generator: regenerate, copy all, download. */
export function GeneratedList({
  title,
  values,
  onRegenerate,
  filename,
  error,
  children,
  onCopied,
}: {
  title: string;
  values: readonly string[];
  onRegenerate: () => void;
  filename: string;
  error?: string | null;
  children?: ReactNode;
  onCopied?: () => void;
}) {
  const text = values.join('\n');
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle2" component="h2" sx={{ flex: 1 }}>
            {title}
            {values.length > 1 ? ` (${values.length})` : ''}
          </Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={<Refresh2 size={16} color="currentColor" />}
            onClick={onRegenerate}
          >
            Generate
          </Button>
          <CopyButton value={text} label="Copy all" onCopied={onCopied} />
          <DownloadButton content={text} filename={filename} mimeType="text/plain" />
        </Stack>
        {children}
        {error ? (
          <Typography role="alert" color="error" variant="body2">
            {error}
          </Typography>
        ) : (
          <MonoTextField
            label={title}
            value={text}
            minRows={Math.min(values.length, 8)}
            maxRows={20}
            slotProps={{ input: { readOnly: true } }}
          />
        )}
      </Stack>
    </Paper>
  );
}
