import { Alert, Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { ArrowLeft, Flash } from 'iconsax-reactjs';
import type { ReactNode } from 'react';
import { CodeEditor, CopyButton, EmptyState, Kbd, Panel, useNotify } from '@/components';
import { DownloadButton } from '@/components/inputs/DownloadButton';
import { ParseError, toUserMessage } from '@/core/errors/AppError';
import { formatBytes } from '@/core/format/bytes';
import type { OperationState } from '../hooks/useJsonOperation';

export interface OutputPanelProps<T> {
  title?: string;
  state: OperationState<T>;
  /** Text shown in the editor (derived from the result). */
  text: string | undefined;
  language?: string;
  filename: string;
  mimeType?: string;
  /** Called after copy/download (history recording). */
  onExported?: (kind: 'copy' | 'download') => void;
  onUseAsInput?: (text: string) => void;
  /** Extra chips (e.g. "Saved 42%"). */
  meta?: ReactNode;
  /** Non-blocking warnings rendered above the output. */
  warnings?: ReactNode;
  emptyHint?: string;
  /** Replace the editor with custom content (e.g. a tree or table). */
  children?: ReactNode;
}

export function OutputPanel<T>({
  title = 'Output',
  state,
  text,
  language = 'json',
  filename,
  mimeType = 'application/json',
  onExported,
  onUseAsInput,
  meta,
  warnings,
  emptyHint = 'Paste, type, drop or open JSON in the input to see the result here.',
  children,
}: OutputPanelProps<T>) {
  const notify = useNotify();
  const hasOutput = text !== undefined && state.status !== 'error';
  const inputError = state.error instanceof ParseError;

  return (
    <Panel
      title={title}
      busy={state.status === 'running'}
      meta={
        <>
          {state.status === 'success' && state.durationMs !== null && (
            <Chip
              size="small"
              variant="outlined"
              label={`${state.durationMs} ms`}
              sx={{ height: 20, fontSize: 11 }}
            />
          )}
          {meta}
        </>
      }
      actions={
        <>
          {!state.autoRun && (
            <Tooltip title="Large input: run manually (Ctrl/⌘+Enter)" describeChild>
              <Button
                size="small"
                variant={state.stale ? 'contained' : 'outlined'}
                startIcon={<Flash size={14} color="currentColor" />}
                onClick={state.run}
              >
                Run
              </Button>
            </Tooltip>
          )}
          {onUseAsInput && (
            <Tooltip title="Use output as input">
              <span>
                <IconButton
                  size="small"
                  aria-label="Use output as input"
                  disabled={!hasOutput}
                  onClick={() => {
                    if (text !== undefined) onUseAsInput(text);
                  }}
                >
                  <ArrowLeft size={18} color="currentColor" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {hasOutput ? (
            <CopyButton
              label="Copy output"
              value={() => text}
              onCopied={() => {
                onExported?.('copy');
              }}
              onError={() => {
                notify.error('Clipboard access was denied by the browser.');
              }}
            />
          ) : null}
          <DownloadButton
            content={() => text ?? ''}
            filename={filename}
            mimeType={mimeType}
            disabled={!hasOutput}
            onDownloaded={() => {
              onExported?.('download');
            }}
          />
        </>
      }
      footer={
        hasOutput ? (
          <Typography variant="caption" color="text.secondary">
            {formatBytes(text.length)}
          </Typography>
        ) : undefined
      }
    >
      {state.status === 'error' && state.error && (
        <Alert severity="error" variant="outlined" sx={{ m: 1.5, borderRadius: 2 }} role="alert">
          {inputError ? 'Fix the input to see the result. ' : ''}
          {toUserMessage(state.error)}
        </Alert>
      )}
      {warnings}
      {state.status === 'idle' && !state.stale ? (
        <EmptyState dense title="No output yet" description={emptyHint} />
      ) : state.stale && !state.autoRun && text === undefined ? (
        <EmptyState
          dense
          icon={Flash}
          title="Large input"
          description={
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                gap: 0.75,
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              Large documents are processed on demand, in the background. Press{' '}
              <Kbd combo="mod+enter" size="small" /> in the editor, or:
            </Box>
          }
          action={
            <Button
              variant="contained"
              startIcon={<Flash size={16} color="currentColor" />}
              onClick={state.run}
            >
              Run
            </Button>
          }
        />
      ) : children !== undefined ? (
        children
      ) : hasOutput ? (
        <CodeEditor value={text} language={language} readOnly ariaLabel={title} />
      ) : null}
    </Panel>
  );
}
