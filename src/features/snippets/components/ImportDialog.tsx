import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  List,
  ListItem,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { FileDropZone, UploadButton } from '@/components/inputs/FileDropZone';
import { toUserMessage } from '@/core/errors/AppError';
import { SNIPPET_FILE_RULES } from '@/core/files/fileValidation';
import {
  type DuplicateStrategy,
  type ParsedImport,
  parseSnippetFile,
  planImport,
} from '@/core/snippets/exchange';
import type { ImportResult } from '@/services/db/repositories/snippetsRepository';
import type { CodeSnippetEntity } from '@/types/entities';

const MAX_LISTED_ERRORS = 8;

/** Choose a file → preview what it contains → choose what to do with duplicates → import. */
export function ImportDialog({
  open,
  existing,
  onClose,
  onImport,
}: {
  open: boolean;
  existing: readonly CodeSnippetEntity[];
  onClose: () => void;
  onImport: (plan: ReturnType<typeof planImport>) => Promise<ImportResult>;
}) {
  const [file, setFile] = useState<{ name: string; parsed: ParsedImport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<DuplicateStrategy>('skip');
  const [busy, setBusy] = useState(false);
  const duplicates = useMemo(
    () => (file ? planImport(existing, file.parsed.items, 'skip').skipped : 0),
    [file, existing],
  );

  const close = () => {
    setFile(null);
    setError(null);
    setStrategy('skip');
    onClose();
  };
  const load = (text: string, f: File) => {
    try {
      setFile({ name: f.name, parsed: parseSnippetFile(text, f.name) });
      setError(null);
    } catch (e) {
      setFile(null);
      setError(toUserMessage(e));
    }
  };
  const handlers = { rules: SNIPPET_FILE_RULES, onText: load, onError: setError };
  const items = file?.parsed.items.length ?? 0;

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      aria-labelledby="import-snippets-title"
    >
      <DialogTitle id="import-snippets-title">Import snippets</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <FileDropZone {...handlers} label="Drop a snippet file">
            <Box
              sx={{
                border: 1,
                borderStyle: 'dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2.5,
                textAlign: 'center',
              }}
            >
              <Typography variant="body2" sx={{ mb: 1 }}>
                A DevStudio export (<code>.json</code>) or VS Code snippets (
                <code>.code-snippets</code>, <code>&lt;language&gt;.json</code>). Files are read
                locally.
              </Typography>
              <UploadButton {...handlers} label="Choose file" />
            </Box>
          </FileDropZone>
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
          {file && (
            <>
              <Alert severity={items ? 'success' : 'warning'}>
                <strong>{file.name}</strong> (
                {file.parsed.format === 'vscode' ? 'VS Code snippets' : 'DevStudio snippets'}):{' '}
                {items.toLocaleString()} {items === 1 ? 'snippet' : 'snippets'} ready to import
                {file.parsed.errors.length > 0 &&
                  `, ${file.parsed.errors.length.toLocaleString()} invalid (skipped)`}
                .
              </Alert>
              {file.parsed.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" component="h3">
                    Problems
                  </Typography>
                  <List dense aria-label="Import problems" sx={{ py: 0 }}>
                    {file.parsed.errors.slice(0, MAX_LISTED_ERRORS).map((e) => (
                      <ListItem
                        key={e}
                        disableGutters
                        sx={{ py: 0, typography: 'body2', color: 'text.secondary' }}
                      >
                        {e}
                      </ListItem>
                    ))}
                    {file.parsed.errors.length > MAX_LISTED_ERRORS && (
                      <ListItem
                        disableGutters
                        sx={{ py: 0, typography: 'body2', color: 'text.secondary' }}
                      >
                        …and {file.parsed.errors.length - MAX_LISTED_ERRORS} more
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}
              {duplicates > 0 && (
                <FormControl>
                  <FormLabel id="duplicates-label">
                    {duplicates}{' '}
                    {duplicates === 1 ? 'snippet already exists' : 'snippets already exist'} in your
                    library
                  </FormLabel>
                  <RadioGroup
                    aria-labelledby="duplicates-label"
                    value={strategy}
                    onChange={(e) => {
                      setStrategy(e.target.value as DuplicateStrategy);
                    }}
                  >
                    <FormControlLabel
                      value="skip"
                      control={<Radio size="small" />}
                      label="Skip them"
                    />
                    <FormControlLabel
                      value="replace"
                      control={<Radio size="small" />}
                      label="Replace them with the imported version"
                    />
                    <FormControlLabel
                      value="copy"
                      control={<Radio size="small" />}
                      label="Import them as copies"
                    />
                  </RadioGroup>
                </FormControl>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!file || items === 0 || busy}
          onClick={() => {
            if (!file) return;
            setBusy(true);
            onImport(planImport(existing, file.parsed.items, strategy))
              .then(close)
              .catch((e: unknown) => {
                setError(toUserMessage(e));
              })
              .finally(() => {
                setBusy(false);
              });
          }}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
