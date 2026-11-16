import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash } from 'iconsax-reactjs';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  CodeEditor,
  EmptyState,
  SearchInput,
  ToolWorkspace,
  useConfirm,
  useNotify,
} from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import { formatBytes } from '@/core/format/bytes';
import { HTTP_METHODS, parseRequestDraft } from '@/core/http/model';
import {
  type ApiHistorySnapshot,
  apiHistoryRepository,
} from '@/services/db/repositories/apiHistoryRepository';
import { useApiWorkspaceStore } from '@/stores/apiWorkspaceStore';
import { fontFamilies } from '@/theme/tokens';
import { requireTool } from '@/tools/toolRegistry';
import type { ApiHistoryEntity, HttpMethod } from '@/types/entities';

const STATUS_FILTERS = [
  { value: '', label: 'Any status' },
  { value: '2', label: '2xx' },
  { value: '3', label: '3xx' },
  { value: '4', label: '4xx' },
  { value: '5', label: '5xx' },
  { value: '0', label: 'Failed' },
] as const;

function statusChip(h: ApiHistoryEntity) {
  if (h.status === null)
    return <Chip size="small" color="error" variant="outlined" label="Failed" />;
  const c =
    h.status >= 500 ? 'error' : h.status >= 400 ? 'warning' : h.status >= 300 ? 'info' : 'success';
  return <Chip size="small" color={c} variant="outlined" label={String(h.status)} />;
}

function Headers({ label, rows }: { label: string; rows: [string, string][] }) {
  if (rows.length === 0) return null;
  return (
    <Table size="small" aria-label={label}>
      <TableBody>
        {rows.map(([k, v], i) => (
          <TableRow key={`${k}-${String(i)}`}>
            <TableCell sx={{ fontFamily: fontFamilies.mono, fontWeight: 600, width: '35%' }}>
              {k}
            </TableCell>
            <TableCell sx={{ fontFamily: fontFamilies.mono, overflowWrap: 'anywhere' }}>
              {v}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function bodyLanguage(contentType: string): string {
  const t = contentType.toLowerCase();
  if (t.includes('json')) return 'json';
  if (t.includes('html')) return 'html';
  if (t.includes('xml')) return 'xml';
  return 'plaintext';
}

function Detail({
  entry,
  onOpen,
  onCompare,
  onDelete,
}: {
  entry: ApiHistoryEntity;
  onOpen: () => void;
  onCompare: () => void;
  onDelete: () => void;
}) {
  const s = entry.snapshot as unknown as ApiHistorySnapshot;
  const r = s.response;
  return (
    <Stack spacing={2} sx={{ p: 2, overflow: 'auto', minHeight: 0 }} aria-label="History entry">
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography
          sx={{ fontFamily: fontFamilies.mono, overflowWrap: 'anywhere', flex: 1, minWidth: 200 }}
          aria-label="Request line"
        >
          <strong>{s.request.method}</strong> {s.request.url}
        </Typography>
        <Button variant="contained" size="small" disabled={!s.draft} onClick={onOpen}>
          Open in Request Builder
        </Button>
        <Button size="small" disabled={!s.response} onClick={onCompare}>
          Compare with…
        </Button>
        <Tooltip title="Delete entry">
          <IconButton size="small" color="error" aria-label="Delete entry" onClick={onDelete}>
            <Trash size={16} color="currentColor" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {new Date(entry.createdAt).toLocaleString()}
        {s.environment ? ` · environment ${s.environment}` : ''} · credentials and secret values are
        redacted.
      </Typography>
      {s.error && <Alert severity="error">{s.error}</Alert>}
      {r && (
        <Stack direction="row" spacing={0.5}>
          {statusChip(entry)}
          <Chip size="small" variant="outlined" label={`${String(r.durationMs)} ms`} />
          <Chip size="small" variant="outlined" label={formatBytes(r.sizeBytes)} />
        </Stack>
      )}
      <Box>
        <Typography variant="subtitle2" component="h3">
          Request headers
        </Typography>
        <Headers label="Request headers" rows={s.request.headers} />
        {s.request.headers.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            None.
          </Typography>
        )}
      </Box>
      {s.request.body !== null && (
        <Box>
          <Typography variant="subtitle2" component="h3">
            Request body
          </Typography>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.5,
              bgcolor: 'background.sunken',
              borderRadius: 1.5,
              fontFamily: fontFamilies.mono,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              maxHeight: 240,
              overflow: 'auto',
            }}
          >
            {s.request.body}
          </Box>
        </Box>
      )}
      {r && (
        <>
          <Box>
            <Typography variant="subtitle2" component="h3">
              Response headers
            </Typography>
            <Headers label="Response headers" rows={r.headers} />
          </Box>
          <Box>
            <Typography variant="subtitle2" component="h3">
              Response body{r.bodyTruncated ? ' (truncated)' : ''}
            </Typography>
            {r.body === null ? (
              <Typography variant="body2" color="text.secondary">
                Binary content is not kept in history.
              </Typography>
            ) : (
              <Box
                sx={{
                  height: 320,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                }}
              >
                <CodeEditor
                  value={r.body}
                  readOnly
                  language={bodyLanguage(r.contentType)}
                  ariaLabel="History response body"
                />
              </Box>
            )}
          </Box>
        </>
      )}
    </Stack>
  );
}

export default function HistoryPage() {
  const tool = requireTool('api.history');
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<HttpMethod | ''>('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const entries = useLiveQuery(
    () =>
      apiHistoryRepository.list({
        query,
        method: method || null,
        statusClass: status === '' ? null : Number(status),
      }),
    [query, method, status],
  );
  const total = useLiveQuery(() => apiHistoryRepository.list({}, 1).then((l) => l.length), []);
  const confirm = useConfirm();
  const notify = useNotify();
  const navigate = useNavigate();
  const selected = entries?.find((e) => e.id === selectedId) ?? entries?.[0] ?? null;

  const open = async (entry: ApiHistoryEntity) => {
    const s = entry.snapshot as unknown as ApiHistorySnapshot;
    const state = useApiWorkspaceStore.getState();
    if (state.dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        message: 'The request open in the builder has changes that are not saved.',
        confirmLabel: 'Discard',
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      state.load(parseRequestDraft(s.draft), null);
      state.set({ dirty: true });
      void navigate('/api/requests');
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };

  const remove = async (entry: ApiHistoryEntity) => {
    try {
      await apiHistoryRepository.remove(entry.id);
      setSelectedId(null);
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };

  return (
    <ToolWorkspace
      tool={tool}
      toolbar={
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <SearchInput value={query} onChange={setQuery} label="Search URLs" />
          <TextField
            select
            size="small"
            label="Method"
            value={method}
            onChange={(e) => {
              setMethod(HTTP_METHODS.find((m) => m === e.target.value) ?? '');
            }}
            sx={{ width: 130 }}
          >
            <MenuItem value="">Any method</MenuItem>
            {HTTP_METHODS.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
            }}
            sx={{ width: 130 }}
          >
            {STATUS_FILTERS.map((f) => (
              <MenuItem key={f.value} value={f.value}>
                {f.label}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Button
            color="error"
            disabled={!total}
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: 'Clear the request history?',
                  message: 'Every entry will be deleted from this browser.',
                  confirmLabel: 'Clear history',
                  destructive: true,
                });
                if (!ok) return;
                await apiHistoryRepository.clear();
                notify.success('History cleared');
              })().catch((error: unknown) => {
                notify.error(toUserMessage(error));
              });
            }}
          >
            Clear history
          </Button>
        </Stack>
      }
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          p: { xs: 1.5, sm: 2 },
          flex: 1,
          minHeight: 0,
        }}
      >
        {entries && entries.length === 0 ? (
          <EmptyState
            title={total ? 'No matching requests' : 'No requests yet'}
            description={
              total
                ? 'Change the filters to see more.'
                : 'Requests you send from the Request Builder appear here, with credentials redacted. The last 500 are kept.'
            }
          />
        ) : (
          <>
            <Paper
              variant="outlined"
              sx={{
                width: { md: 380 },
                flexShrink: 0,
                borderRadius: 2.5,
                overflow: 'auto',
                maxHeight: { xs: 320, md: 'none' },
              }}
            >
              <List dense aria-label="History">
                {(entries ?? []).map((h) => (
                  <li key={h.id}>
                    <ListItemButton
                      selected={h.id === selected?.id}
                      onClick={() => {
                        setSelectedId(h.id);
                      }}
                    >
                      <Typography
                        component="span"
                        sx={{
                          width: 60,
                          flexShrink: 0,
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: fontFamilies.mono,
                        }}
                      >
                        {h.method}
                      </Typography>
                      <ListItemText
                        primary={h.url}
                        secondary={formatDistanceToNowStrict(h.createdAt, { addSuffix: true })}
                        slotProps={{
                          primary: {
                            noWrap: true,
                            variant: 'body2',
                            sx: { fontFamily: fontFamilies.mono },
                          },
                        }}
                      />
                      <Box sx={{ ml: 1 }}>{statusChip(h)}</Box>
                    </ListItemButton>
                  </li>
                ))}
              </List>
            </Paper>
            <Paper
              variant="outlined"
              sx={{
                flex: 1,
                minWidth: 0,
                borderRadius: 2.5,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              {selected && (
                <Detail
                  key={selected.id}
                  entry={selected}
                  onOpen={() => void open(selected)}
                  onCompare={() => void navigate(`/api/compare?left=${selected.id}`)}
                  onDelete={() => void remove(selected)}
                />
              )}
            </Paper>
          </>
        )}
      </Box>
    </ToolWorkspace>
  );
}
