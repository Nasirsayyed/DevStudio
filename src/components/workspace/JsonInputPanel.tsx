import { Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { CloseCircle, FolderOpen, MagicStar, Save2 } from 'iconsax-reactjs';
import { type ReactNode, useMemo, useState } from 'react';
import { CodeEditor, type EditorMarker, Panel, type RevealRequest, useNotify } from '@/components';
import { FileDropZone, UploadButton } from '@/components/inputs/FileDropZone';
import type { ParseError } from '@/core/errors/AppError';
import { type FileRules, JSON_FILE_RULES } from '@/core/files/fileValidation';
import { formatBytes } from '@/core/format/bytes';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { OpenDocumentDialog, SaveDocumentDialog } from './DocumentDialogs';

export interface JsonInputPanelProps {
  title?: string;
  value: string;
  onChange: (value: string) => void;
  /** Parse error to highlight (null = none). */
  error?: ParseError | null;
  /** Additional markers (e.g. duplicate-key warnings). */
  markers?: readonly EditorMarker[];
  /** Externally requested cursor jump. */
  reveal?: RevealRequest | null;
  /** Shows "Valid" in the status bar when true. */
  valid?: boolean;
  /** Monaco language id ('json', 'plaintext', 'xml', …). */
  language?: string;
  rules?: FileRules;
  sample?: string;
  /** Enables Open/Save of saved documents (main input only). */
  documents?: boolean;
  onRun?: () => void;
  extraActions?: ReactNode;
  /** Called after a file was opened (e.g. to pick a language from its name). */
  onFileLoaded?: (fileName: string) => void;
}

const VALID_LABELS: Record<string, string> = {
  json: 'JSON',
  xml: 'XML',
  yaml: 'YAML',
  html: 'HTML',
};

function countLines(text: string): number {
  let n = 1;
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n += 1;
  return n;
}

export function JsonInputPanel({
  title = 'Input',
  value,
  onChange,
  error = null,
  markers: extraMarkers,
  reveal: externalReveal,
  valid,
  language = 'json',
  rules = JSON_FILE_RULES,
  sample,
  documents = false,
  onRun,
  extraActions,
  onFileLoaded,
}: JsonInputPanelProps) {
  const notify = useNotify();
  const document = useJsonWorkspaceStore((s) => s.document);
  const loadDocument = useJsonWorkspaceStore((s) => s.loadDocument);
  const setDocument = useJsonWorkspaceStore((s) => s.setDocument);
  const [openDialog, setOpenDialog] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [reveal, setReveal] = useState<RevealRequest | null>(null);

  const markers = useMemo<EditorMarker[]>(() => {
    const list: EditorMarker[] = [...(extraMarkers ?? [])];
    if (error?.line !== undefined)
      list.push({
        line: error.line,
        column: error.column ?? 1,
        message: error.message,
        severity: 'error',
      });
    return list;
  }, [error, extraMarkers]);

  const lines = useMemo(() => countLines(value), [value]);

  const setText = (text: string, label?: string) => {
    if (documents) loadDocument(text, null);
    else onChange(text);
    if (label) notify.info(label);
  };

  return (
    <Panel
      title={title}
      meta={
        documents && document ? (
          <Chip
            size="small"
            variant="outlined"
            label={document.name}
            onDelete={() => {
              setDocument(null);
            }}
            sx={{ maxWidth: 220 }}
          />
        ) : undefined
      }
      actions={
        <>
          {extraActions}
          {documents && (
            <>
              <Tooltip title="Open saved document">
                <IconButton
                  size="small"
                  aria-label="Open saved document"
                  onClick={() => {
                    setOpenDialog(true);
                  }}
                >
                  <FolderOpen size={18} color="currentColor" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Save document">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Save document"
                    disabled={!value.trim()}
                    onClick={() => {
                      setSaveDialog(true);
                    }}
                  >
                    <Save2 size={18} color="currentColor" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          <UploadButton
            compact
            rules={rules}
            label="Open file"
            onText={(text, file) => {
              setText(text, `Loaded ${file.name}`);
              onFileLoaded?.(file.name);
            }}
            onError={notify.error}
          />
          {sample !== undefined && (
            <Tooltip title="Load sample">
              <IconButton
                size="small"
                aria-label="Load sample"
                onClick={() => {
                  setText(sample);
                }}
              >
                <MagicStar size={18} color="currentColor" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Clear">
            <span>
              <IconButton
                size="small"
                aria-label={`Clear ${title.toLowerCase()}`}
                disabled={!value}
                onClick={() => {
                  setText('');
                }}
              >
                <CloseCircle size={18} color="currentColor" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      }
      footer={
        <>
          <Typography variant="caption" color="text.secondary">
            {formatBytes(value.length)} · {lines.toLocaleString()} lines
          </Typography>
          <Box sx={{ flex: 1 }} />
          {error ? (
            <Button
              size="small"
              color="error"
              onClick={() => {
                if (error.line !== undefined)
                  setReveal({ line: error.line, column: error.column ?? 1, token: Date.now() });
              }}
              sx={{ py: 0, minHeight: 24, textTransform: 'none', maxWidth: '100%' }}
              aria-label={`Go to error: ${error.message}`}
            >
              <Typography variant="caption" noWrap>
                ✕ {error.line !== undefined ? `Ln ${error.line}, Col ${error.column ?? 1}: ` : ''}
                {error.message
                  .replace(/ \(line \d+, column \d+\)$/, '')
                  .replace(/^[A-Za-z ]+: /, '')}
              </Typography>
            </Button>
          ) : valid && value.trim() ? (
            <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
              ✓ Valid {VALID_LABELS[language] ?? ''}
            </Typography>
          ) : null}
        </>
      }
    >
      <FileDropZone
        rules={rules}
        onText={(text, file) => {
          setText(text, `Loaded ${file.name}`);
        }}
        onError={notify.error}
      >
        <CodeEditor
          value={value}
          onChange={
            documents
              ? (v) => {
                  onChange(v);
                }
              : onChange
          }
          language={language}
          markers={markers}
          reveal={reveal ?? externalReveal ?? null}
          ariaLabel={title}
          onRun={onRun}
        />
      </FileDropZone>
      <OpenDocumentDialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
        }}
        onOpen={(doc) => {
          loadDocument(doc.content, { id: doc.id, name: doc.name });
          setOpenDialog(false);
          notify.info(`Opened "${doc.name}"`);
        }}
      />
      <SaveDocumentDialog
        open={saveDialog}
        current={document}
        content={value}
        onClose={() => {
          setSaveDialog(false);
        }}
        onSaved={(doc) => {
          setDocument(doc);
          setSaveDialog(false);
        }}
      />
    </Panel>
  );
}
