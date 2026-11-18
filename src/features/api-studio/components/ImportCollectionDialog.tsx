import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNotify } from '@/components';
import { UploadButton } from '@/components/inputs/FileDropZone';
import { toUserMessage } from '@/core/errors/AppError';
import { COLLECTION_FILE_RULES } from '@/core/files/fileValidation';
import { importCollection } from '@/core/http/collections';
import { apiCollectionsRepository } from '@/services/db/repositories/apiCollectionsRepository';
import { fontFamilies } from '@/theme/tokens';

/** Import a DevStudio or Postman v2.0/v2.1 collection file (validated, scripts never run). */
export function ImportCollectionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const notify = useNotify();
  const result = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return { ok: true as const, value: importCollection(text) };
    } catch (error) {
      return { ok: false as const, error: toUserMessage(error) };
    }
  }, [text]);

  const close = () => {
    setText('');
    onClose();
  };

  const submit = async () => {
    if (!result?.ok) return;
    setBusy(true);
    try {
      const c = await apiCollectionsRepository.importBundle(result.value.bundle);
      notify.success(
        `Imported "${c.name}" (${String(result.value.bundle.requests.length)} requests).`,
      );
      close();
    } catch (error) {
      notify.error(toUserMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="md"
      aria-labelledby="import-collection-title"
    >
      <DialogTitle id="import-collection-title">Import collection</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            DevStudio collections and Postman collection exports (format v2.0 or v2.1). Scripts in
            Postman files are ignored, never run.
          </Typography>
          <div>
            <UploadButton
              label="Choose file"
              rules={COLLECTION_FILE_RULES}
              onText={setText}
              onError={notify.error}
            />
          </div>
          <TextField
            label="Or paste the collection JSON"
            multiline
            minRows={4}
            maxRows={10}
            value={text.length > 200_000 ? `${text.slice(0, 200_000)}…` : text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            slotProps={{
              htmlInput: {
                spellCheck: false,
                style: { fontFamily: fontFamilies.mono, fontSize: 12 },
              },
            }}
          />
          {result && !result.ok && <Alert severity="error">{result.error}</Alert>}
          {result?.ok && (
            <Alert severity="success" icon={false} aria-label="Import preview">
              <strong>{result.value.bundle.name}</strong> (
              {result.value.format === 'postman' ? 'Postman' : 'DevStudio'}):{' '}
              {result.value.bundle.requests.length} requests, {result.value.bundle.folders.length}{' '}
              folders, {result.value.bundle.variables.length} variables.
            </Alert>
          )}
          {result?.ok &&
            result.value.warnings.map((w) => (
              <Alert key={w} severity="warning" sx={{ py: 0 }}>
                {w}
              </Alert>
            ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained" disabled={!result?.ok || busy} onClick={() => void submit()}>
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
