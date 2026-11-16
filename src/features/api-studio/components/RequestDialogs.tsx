import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { CodeEditor, CopyButton } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import { buildRequest } from '@/core/http/build';
import { parseCurl } from '@/core/http/curl';
import type { VariableScope } from '@/core/http/interpolate';
import { hasLiteralCredentials, type RequestDraft } from '@/core/http/model';
import { requestSnippet, SNIPPET_LANGUAGES, type SnippetLanguage } from '@/core/http/snippets';
import { apiCollectionsRepository } from '@/services/db/repositories/apiCollectionsRepository';
import { fontFamilies } from '@/theme/tokens';
import type { CollectionFolder } from '@/types/entities';

const NEW_COLLECTION = '__new__';

export interface SaveTarget {
  name: string;
  collectionId: string;
  folderId: string | null;
  /** Store literal credentials (basic password, tokens, API keys) with the request. */
  keepCredentials: boolean;
}

function folderPaths(folders: readonly CollectionFolder[]): { id: string; label: string }[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const label = (f: CollectionFolder): string => {
    const parts = [f.name];
    let p = f.parentId ? byId.get(f.parentId) : undefined;
    let guard = 0;
    while (p && guard++ < 50) {
      parts.unshift(p.name);
      p = p.parentId ? byId.get(p.parentId) : undefined;
    }
    return parts.join(' / ');
  };
  return folders
    .map((f) => ({ id: f.id, label: label(f) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Save a request into a collection (optionally a new one), with consent for credentials. */
export function SaveRequestDialog({
  open,
  draft,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  draft: RequestDraft;
  initial: { collectionId: string | null; folderId: string | null };
  onClose: () => void;
  onSave: (target: SaveTarget) => Promise<void>;
}) {
  const collections = useLiveQuery(() => apiCollectionsRepository.listCollections(), []);
  const [name, setName] = useState(draft.name || 'New request');
  const [collectionId, setCollectionId] = useState<string | null>(initial.collectionId);
  const [newCollection, setNewCollection] = useState('My collection');
  const [folderId, setFolderId] = useState<string | null>(initial.folderId);
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const credentials = hasLiteralCredentials(draft.auth);

  const selected =
    collectionId && collections?.some((c) => c.id === collectionId)
      ? collectionId
      : collections && collections.length > 0 && collectionId !== NEW_COLLECTION
        ? (collections[0]?.id ?? NEW_COLLECTION)
        : NEW_COLLECTION;
  const collection = collections?.find((c) => c.id === selected);
  const folders = collection ? folderPaths(collection.folders) : [];
  const folder = folders.some((f) => f.id === folderId) ? folderId : null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      let target = selected;
      if (target === NEW_COLLECTION)
        target = (await apiCollectionsRepository.saveCollection({ name: newCollection })).id;
      await onSave({
        name,
        collectionId: target,
        folderId: target === selected ? folder : null,
        keepCredentials: credentials && keep,
      });
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="save-request-title"
    >
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <DialogTitle id="save-request-title">Save request</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Name"
              value={name}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
              }}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <TextField
              select
              size="small"
              label="Collection"
              value={selected}
              onChange={(e) => {
                setCollectionId(e.target.value);
                setFolderId(null);
              }}
            >
              {(collections ?? []).map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
              <MenuItem value={NEW_COLLECTION}>New collection…</MenuItem>
            </TextField>
            {selected === NEW_COLLECTION && (
              <TextField
                size="small"
                label="New collection name"
                value={newCollection}
                onChange={(e) => {
                  setNewCollection(e.target.value);
                }}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            )}
            {folders.length > 0 && (
              <TextField
                select
                size="small"
                label="Folder"
                value={folder ?? ''}
                onChange={(e) => {
                  setFolderId(e.target.value || null);
                }}
              >
                <MenuItem value="">(Collection root)</MenuItem>
                {folders.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {credentials && (
              <Alert severity="warning" icon={false}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  This request contains credentials typed directly into the Auth tab. By default
                  they are <strong>not</strong> saved; use a secret environment variable such as{' '}
                  <Box component="code" sx={{ fontFamily: fontFamilies.mono }}>
                    {'{{token}}'}
                  </Box>{' '}
                  instead.
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={keep}
                      onChange={(e) => {
                        setKeep(e.target.checked);
                      }}
                    />
                  }
                  label="Save the credentials with the request, unencrypted, in this browser"
                />
              </Alert>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy || !name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/** Generated code for the request (with variables resolved). */
export function CodeSnippetDialog({
  open,
  draft,
  scopes,
  onClose,
}: {
  open: boolean;
  draft: RequestDraft;
  scopes: VariableScope[];
  onClose: () => void;
}) {
  const [language, setLanguage] = useState<SnippetLanguage>('curl');
  const result = useMemo(() => {
    if (!open) return { code: '', error: null };
    try {
      return { code: requestSnippet(buildRequest(draft, scopes), language), error: null };
    } catch (e) {
      return { code: '', error: toUserMessage(e) };
    }
  }, [open, draft, scopes, language]);
  const meta = SNIPPET_LANGUAGES.find((l) => l.id === language);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="snippet-title">
      <DialogTitle id="snippet-title">Code snippet</DialogTitle>
      <DialogContent dividers>
        <Tabs
          value={language}
          onChange={(_, v: SnippetLanguage) => {
            setLanguage(v);
          }}
          aria-label="Language"
          sx={{ mb: 1 }}
        >
          {SNIPPET_LANGUAGES.map((l) => (
            <Tab key={l.id} value={l.id} label={l.label} />
          ))}
        </Tabs>
        {result.error ? (
          <Alert severity="error">{result.error}</Alert>
        ) : (
          <Box
            sx={{
              height: 360,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5,
              overflow: 'hidden',
            }}
          >
            <CodeEditor
              value={result.code}
              readOnly
              language={meta?.monaco ?? 'plaintext'}
              ariaLabel="Generated code"
            />
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Variables are resolved, so the snippet may contain secret values. Files are referenced by
          name.
        </Typography>
      </DialogContent>
      <DialogActions>
        <CopyButton label="Copy code" value={result.code} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Paste a cURL command and turn it into a request. */
export function CurlImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (draft: RequestDraft) => void;
}) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return { ok: true as const, value: parseCurl(text) };
    } catch (e) {
      return { ok: false as const, error: toUserMessage(e) };
    }
  }, [text]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="curl-title">
      <DialogTitle id="curl-title">Import cURL command</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="cURL command"
          multiline
          minRows={6}
          maxRows={16}
          fullWidth
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          placeholder={
            'curl -X POST https://api.example.com/items \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"name":"x"}\''
          }
          slotProps={{
            htmlInput: {
              spellCheck: false,
              style: { fontFamily: fontFamilies.mono, fontSize: 13 },
            },
          }}
        />
        {parsed && !parsed.ok && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {parsed.error}
          </Alert>
        )}
        {parsed?.ok && (
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            <Typography
              variant="body2"
              sx={{ fontFamily: fontFamilies.mono, overflowWrap: 'anywhere' }}
              aria-label="Parsed request"
            >
              <strong>{parsed.value.request.method}</strong> {parsed.value.request.url}
            </Typography>
            {parsed.value.notes.map((n) => (
              <Alert key={n} severity="info" sx={{ py: 0 }}>
                {n}
              </Alert>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!parsed?.ok}
          onClick={() => {
            if (parsed?.ok) {
              onImport(parsed.value.request);
              setText('');
            }
          }}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
