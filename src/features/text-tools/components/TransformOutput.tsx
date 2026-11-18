import { Chip } from '@mui/material';
import type { ReactNode } from 'react';
import { useNotify } from '@/components';
import { OutputPanel } from '@/components/workspace/OutputPanel';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import type { OperationState } from '@/hooks/useTaskOperation';

/** Output editor of the single-input text transforms, with "use as input" and history. */
export function TransformOutput<T>({
  toolId,
  label,
  state,
  text,
  input,
  onUseAsInput,
  historyOptions,
  language = 'plaintext',
  filename = 'output.txt',
  mimeType = 'text/plain',
  meta,
  warnings,
  emptyHint = 'Paste, type or open text on the left.',
  useAsInputLabel = 'Use output as input',
}: {
  toolId: string;
  label: string;
  state: OperationState<T>;
  text: string | undefined;
  input: string;
  onUseAsInput?: (text: string) => void;
  historyOptions?: object;
  language?: string;
  filename?: string;
  mimeType?: string;
  meta?: ReactNode;
  warnings?: ReactNode;
  emptyHint?: string;
  useAsInputLabel?: string;
}) {
  const record = useHistoryRecorder(toolId);
  const notify = useNotify();
  return (
    <OutputPanel
      state={state}
      text={text}
      language={language}
      filename={filename}
      mimeType={mimeType}
      wordWrap
      emptyHint={emptyHint}
      useAsInputLabel={useAsInputLabel}
      meta={meta}
      warnings={warnings}
      onExported={(kind) => {
        if (text !== undefined) record(`${label} (${kind})`, input, text, historyOptions);
      }}
      {...(onUseAsInput
        ? {
            onUseAsInput: (t: string) => {
              onUseAsInput(t);
              notify.info('The output is now the input.');
            },
          }
        : {})}
    />
  );
}

export function CountChip({ label }: { label: string }) {
  return <Chip size="small" variant="outlined" label={label} sx={{ height: 20, fontSize: 11 }} />;
}
