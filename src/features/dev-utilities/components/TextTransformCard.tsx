import { Alert, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { CopyButton } from '@/components';
import { MonoTextField } from './MonoTextField';

export interface TransformResult {
  text?: string;
  error?: string;
}

export interface TextTransformCardProps<M extends string> {
  modes: readonly { value: M; label: string }[];
  mode: M;
  onModeChange: (mode: M) => void;
  input: string;
  onInputChange: (value: string) => void;
  inputLabel: string;
  inputPlaceholder?: string;
  result: TransformResult;
  outputLabel: string;
  /** Options shown between the mode switch and the input. */
  options?: ReactNode;
  /** Actions beside the output copy button. */
  outputActions?: ReactNode;
  /** Replaces the text output (e.g. binary preview). */
  outputOverride?: ReactNode;
  onCopied?: () => void;
}

/** Encode/decode style card: mode switch, input, live output with copy. */
export function TextTransformCard<M extends string>({
  modes,
  mode,
  onModeChange,
  input,
  onInputChange,
  inputLabel,
  inputPlaceholder,
  result,
  outputLabel,
  options,
  outputActions,
  outputOverride,
  onCopied,
}: TextTransformCardProps<M>) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            aria-label="Mode"
            onChange={(_, v: M | null) => {
              if (v) onModeChange(v);
            }}
          >
            {modes.map((m) => (
              <ToggleButton key={m.value} value={m.value} sx={{ px: 2 }}>
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {options}
        </Stack>
        <MonoTextField
          label={inputLabel}
          placeholder={inputPlaceholder}
          value={input}
          onChange={(e) => {
            onInputChange(e.target.value);
          }}
        />
        {result.error ? (
          <Alert severity="error" role="alert" sx={{ borderRadius: 2 }}>
            {result.error}
          </Alert>
        ) : outputOverride ? (
          outputOverride
        ) : (
          <Stack spacing={0.5}>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                {outputLabel}
                {result.text ? ` · ${result.text.length.toLocaleString()} characters` : ''}
              </Typography>
              {outputActions}
              <CopyButton
                value={result.text ?? ''}
                label={`Copy ${outputLabel.toLowerCase()}`}
                onCopied={onCopied}
              />
            </Stack>
            <MonoTextField
              label={outputLabel}
              value={result.text ?? ''}
              slotProps={{ input: { readOnly: true } }}
            />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
