import { Box, Button, IconButton, Stack, Tooltip, Typography, alpha } from '@mui/material';
import { DocumentUpload } from 'iconsax-reactjs';
import { type DragEvent, type ReactNode, useRef, useState } from 'react';
import { type FileRules, JSON_FILE_RULES, validateFileMeta } from '@/core/files/fileValidation';
import { toUserMessage } from '@/core/errors/AppError';
import { readTextFile } from '@/services/files/textFiles';

export interface FileTextHandlers {
  rules?: FileRules;
  onText: (text: string, file: File) => void;
  /** Receive the validated File itself instead of its text (binary files). */
  onFile?: (file: File) => void;
  onError: (message: string) => void;
}

async function handleFile(
  file: File,
  { rules = JSON_FILE_RULES, onText, onFile, onError }: FileTextHandlers,
) {
  try {
    if (onFile) {
      validateFileMeta(file, rules);
      onFile(file);
      return;
    }
    onText(await readTextFile(file, rules), file);
  } catch (error) {
    onError(toUserMessage(error, `Could not read "${file.name}".`));
  }
}

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files');
}

/** Wraps content and accepts a dropped text file (validated, BOM-stripped). */
export function FileDropZone({
  children,
  label = 'Drop a file to open it',
  ...handlers
}: FileTextHandlers & { children: ReactNode; label?: string }) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  return (
    <Box
      sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setActive(true);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setActive(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setActive(false);
        const file = e.dataTransfer.files[0];
        if (file) void handleFile(file, handlers);
      }}
    >
      {children}
      {active && (
        <Stack
          aria-hidden
          sx={(t) => ({
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            border: 2,
            borderStyle: 'dashed',
            borderColor: 'primary.main',
            borderRadius: 2,
            bgcolor: alpha(t.palette.background.paper, 0.9),
            pointerEvents: 'none',
          })}
        >
          <DocumentUpload size={32} color="currentColor" variant="Bulk" />
          <Typography variant="subtitle1">{label}</Typography>
        </Stack>
      )}
    </Box>
  );
}

/** Button that opens a file picker with the same validation as FileDropZone. */
export function UploadButton({
  label = 'Open file',
  compact = false,
  ...handlers
}: FileTextHandlers & { label?: string; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = (handlers.rules ?? JSON_FILE_RULES).extensions.join(',');
  const open = () => inputRef.current?.click();
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFile(file, handlers);
        }}
      />
      {compact ? (
        <Tooltip title={label}>
          <IconButton size="small" onClick={open} aria-label={label}>
            <DocumentUpload size={18} color="currentColor" />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          size="small"
          startIcon={<DocumentUpload size={16} color="currentColor" />}
          onClick={open}
        >
          {label}
        </Button>
      )}
    </>
  );
}
