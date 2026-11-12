import { Alert, Chip, IconButton, Tooltip } from '@mui/material';
import { ArchiveBook } from 'iconsax-reactjs';
import { useNotify } from '@/components';
import { OutputPanel } from '@/components/workspace/OutputPanel';
import type { GeneratedCode } from '@/core/codegen/model';
import { toUserMessage } from '@/core/errors/AppError';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import type { OperationState } from '@/hooks/useTaskOperation';
import { downloadZip } from '@/services/files/zip';

/** Generated code with copy, download, ZIP (one file per class) and history. */
export function GeneratedCodeOutput({
  toolId,
  label,
  state,
  input,
  language,
  filename,
  zipName,
  historyOptions,
}: {
  toolId: string;
  label: string;
  state: OperationState<GeneratedCode>;
  input: string;
  language: string;
  filename: string;
  zipName?: string;
  historyOptions: object;
}) {
  const record = useHistoryRecorder(toolId);
  const notify = useNotify();
  const result = state.status === 'success' ? state.result : undefined;
  const files = result?.files ?? [];
  return (
    <OutputPanel
      title="Generated code"
      state={state}
      text={result?.code}
      language={language}
      filename={filename}
      mimeType="text/plain"
      wordWrap={false}
      emptyHint="Paste one or more CREATE TABLE statements on the left."
      onExported={(kind) => {
        if (result) record(`${label} (${kind})`, input, result.code, historyOptions);
      }}
      meta={
        result ? (
          <Chip
            size="small"
            variant="outlined"
            label={`${String(files.length)} ${files.length === 1 ? 'type' : 'types'}`}
            sx={{ height: 20, fontSize: 11 }}
          />
        ) : undefined
      }
      extraActions={
        zipName && files.length > 1 ? (
          <Tooltip title={`Download ${String(files.length)} files as ZIP`}>
            <IconButton
              size="small"
              aria-label="Download as ZIP"
              onClick={() => {
                downloadZip(files, zipName)
                  .then(() => {
                    if (result) record(`${label} (zip)`, input, result.code, historyOptions);
                  })
                  .catch((error: unknown) => {
                    notify.error(toUserMessage(error, 'Could not create the ZIP file.'));
                  });
              }}
            >
              <ArchiveBook size={18} color="currentColor" />
            </IconButton>
          </Tooltip>
        ) : null
      }
      warnings={
        result && result.notes.length > 0 ? (
          <Alert severity="info" variant="outlined" sx={{ m: 1.5, mb: 0, borderRadius: 2 }}>
            {result.notes.slice(0, 3).join(' ')}
          </Alert>
        ) : null
      }
    />
  );
}
