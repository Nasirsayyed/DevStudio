import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { Global, Trash } from 'iconsax-reactjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  CodeEditor,
  CopyButton,
  EmptyState,
  PageContainer,
  SearchInput,
  ToolHeader,
  ToolIcon,
  useConfirm,
  useNotify,
} from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import { parseRequestDraft } from '@/core/http/model';
import { toolHistoryRepository } from '@/services/db/repositories';
import {
  type ApiHistorySnapshot,
  apiHistoryRepository,
} from '@/services/db/repositories/apiHistoryRepository';
import { TRUNCATION_MARKER } from '@/services/db/repositories/toolHistoryRepository';
import { useApiWorkspaceStore } from '@/stores/apiWorkspaceStore';
import { fontFamilies } from '@/theme/tokens';
import { getModule, MODULES } from '@/tools/modules';
import { getTool, toolPath } from '@/tools/toolRegistry';
import type { ApiHistoryEntity, ToolHistoryEntity } from '@/types/entities';
import type { ModuleId } from '@/types/tools';
import { canRestore, restoreInput } from '../restore';

type Entry =
  | { kind: 'tool'; at: number; id: string; row: ToolHistoryEntity }
  | { kind: 'api'; at: number; id: string; row: ApiHistoryEntity };
type Source = 'all' | 'tool' | 'api';

const PAGE = 100;
const TOOL_MODULES = MODULES.filter((m) => m.hasTools);

function toolTitle(toolId: string): string {
  return getTool(toolId)?.title ?? toolId;
}

function languageFor(toolId: string): string {
  if (toolId.startsWith('json.') || toolId.startsWith('codegen.')) return 'json';
  if (toolId.startsWith('sql.')) return 'sql';
  return 'plaintext';
}

function ToolDetail({ row, onDelete }: { row: ToolHistoryEntity; onDelete: () => void }) {
  const navigate = useNavigate();
  const notify = useNotify();
  const tool = getTool(row.toolId);
  const restorable = canRestore(row.toolId, row.input);
  const truncated = row.input.endsWith(TRUNCATION_MARKER) || row.output.endsWith(TRUNCATION_MARKER);
  return (
    <Stack
      spacing={1.5}
      sx={{ p: 2, minHeight: 0, overflow: 'auto' }}
      aria-label="History entry"
      role="region"
    >
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {tool && <ToolIcon tool={tool} size={20} />}
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Typography variant="subtitle1" component="h2">
            {row.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {toolTitle(row.toolId)} · {new Date(row.createdAt).toLocaleString()}
          </Typography>
        </Box>
        {restorable && tool && (
          <Button
            variant="contained"
            size="small"
            onClick={() => {
              restoreInput(
                row.toolId,
                row.input.endsWith(TRUNCATION_MARKER)
                  ? row.input.slice(0, -TRUNCATION_MARKER.length)
                  : row.input,
                row.options,
              );
              notify.info(`Restored the input in ${tool.title}.`);
              void navigate(toolPath(tool));
            }}
          >
            Restore in {tool.title}
          </Button>
        )}
        {tool && (
          <Button size="small" onClick={() => void navigate(toolPath(tool))}>
            Open tool
          </Button>
        )}
        <Tooltip title="Delete entry">
          <IconButton size="small" color="error" aria-label="Delete entry" onClick={onDelete}>
            <Trash size={16} color="currentColor" />
          </IconButton>
        </Tooltip>
      </Stack>
      {truncated && (
        <Alert severity="info" sx={{ py: 0 }}>
          Large values were truncated to 256 KB when they were recorded.
        </Alert>
      )}
      {(['input', 'output'] as const).map((part) => (
        <Box key={part}>
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle2" component="h3" sx={{ flex: 1 }}>
              {part === 'input' ? 'Input' : 'Output'}
            </Typography>
            <CopyButton label={`Copy ${part}`} value={row[part]} />
          </Stack>
          {row[part] ? (
            <Box
              sx={{
                height: 220,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                overflow: 'hidden',
              }}
            >
              <CodeEditor
                value={row[part]}
                readOnly
                language={part === 'input' ? languageFor(row.toolId) : 'plaintext'}
                ariaLabel={`History ${part}`}
              />
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Empty.
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
}

function ApiDetail({ row, onDelete }: { row: ApiHistoryEntity; onDelete: () => void }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const notify = useNotify();
  const s = row.snapshot as unknown as ApiHistorySnapshot;
  const open = async () => {
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
  return (
    <Stack
      spacing={1.5}
      sx={{ p: 2, minHeight: 0, overflow: 'auto' }}
      aria-label="History entry"
      role="region"
    >
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography
          sx={{ fontFamily: fontFamilies.mono, overflowWrap: 'anywhere', flex: 1, minWidth: 200 }}
          aria-label="Request line"
        >
          <strong>{row.method}</strong> {row.url}
        </Typography>
        <Button variant="contained" size="small" disabled={!s.draft} onClick={() => void open()}>
          Open in Request Builder
        </Button>
        <Button
          size="small"
          disabled={!s.response}
          onClick={() => void navigate(`/api/compare?left=${row.id}`)}
        >
          Compare with…
        </Button>
        <Tooltip title="Delete entry">
          <IconButton size="small" color="error" aria-label="Delete entry" onClick={onDelete}>
            <Trash size={16} color="currentColor" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {new Date(row.createdAt).toLocaleString()}
        {s.environment ? ` · environment ${s.environment}` : ''} · credentials and secrets are
        redacted
      </Typography>
      {s.error && <Alert severity="error">{s.error}</Alert>}
      {s.response && (
        <>
          <Typography variant="body2">
            {s.response.status} {s.response.statusText} · {s.response.durationMs} ms
          </Typography>
          {s.response.body !== null && (
            <Box
              sx={{
                height: 260,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                overflow: 'hidden',
              }}
            >
              <CodeEditor
                value={s.response.body}
                readOnly
                language={s.response.contentType.includes('json') ? 'json' : 'plaintext'}
                ariaLabel="History response body"
              />
            </Box>
          )}
        </>
      )}
    </Stack>
  );
}

export default function HistoryPage() {
  const mod = getModule('history');
  const [source, setSource] = useState<Source>('all');
  const [moduleId, setModuleId] = useState<ModuleId | ''>('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clearMenu, setClearMenu] = useState<HTMLElement | null>(null);
  const confirm = useConfirm();
  const notify = useNotify();
  const tools = useLiveQuery(() => toolHistoryRepository.recent(5000), []);
  const api = useLiveQuery(() => apiHistoryRepository.list({}), []);

  const all = useMemo((): Entry[] | undefined => {
    if (!tools || !api) return undefined;
    return [
      ...tools.map((row): Entry => ({ kind: 'tool', at: row.createdAt, id: row.id, row })),
      ...api.map((row): Entry => ({ kind: 'api', at: row.createdAt, id: row.id, row })),
    ].sort((a, b) => b.at - a.at);
  }, [tools, api]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (all ?? []).filter((e) => {
      if (source !== 'all' && e.kind !== source) return false;
      if (
        moduleId &&
        (e.kind === 'api' ? moduleId !== 'api' : !e.row.toolId.startsWith(`${moduleId}.`))
      )
        return false;
      if (!q) return true;
      return e.kind === 'api'
        ? e.row.url.toLowerCase().includes(q) || e.row.method.toLowerCase() === q
        : e.row.label.toLowerCase().includes(q) ||
            toolTitle(e.row.toolId).toLowerCase().includes(q);
    });
  }, [all, source, moduleId, query]);

  const selected = filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  const remove = async (e: Entry) => {
    try {
      if (e.kind === 'tool') await toolHistoryRepository.remove(e.id);
      else await apiHistoryRepository.remove(e.id);
      setSelectedId(null);
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };

  const clear = async (what: 'tool' | 'api' | 'all') => {
    setClearMenu(null);
    const labels = { tool: 'tool history', api: 'API request history', all: 'all history' };
    const ok = await confirm({
      title: `Clear ${labels[what]}?`,
      message:
        'The entries are deleted from this browser. Saved documents, queries, snippets and collections are not affected.',
      confirmLabel: 'Clear',
      destructive: true,
    });
    if (!ok) return;
    try {
      if (what !== 'api') await toolHistoryRepository.clear();
      if (what !== 'tool') await apiHistoryRepository.clear();
      notify.success('History cleared');
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };

  const total = all?.length ?? 0;

  return (
    <PageContainer>
      <ToolHeader
        title={mod.title}
        description={`${mod.description} Copying or downloading a result records it; API requests are recorded when sent. The latest 1000 tool entries and 500 requests are kept.`}
        icon={mod.icon}
        actions={
          <>
            <Button
              color="error"
              disabled={total === 0}
              aria-haspopup="menu"
              onClick={(e) => {
                setClearMenu(e.currentTarget);
              }}
            >
              Clear…
            </Button>
            <Menu
              anchorEl={clearMenu}
              open={clearMenu !== null}
              onClose={() => {
                setClearMenu(null);
              }}
            >
              <MenuItem onClick={() => void clear('tool')}>Clear tool history</MenuItem>
              <MenuItem onClick={() => void clear('api')}>Clear API request history</MenuItem>
              <MenuItem onClick={() => void clear('all')} sx={{ color: 'error.main' }}>
                Clear all history
              </MenuItem>
            </Menu>
          </>
        }
      />
      <Stack
        direction="row"
        spacing={1.5}
        useFlexGap
        sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 2 }}
      >
        <SearchInput
          value={query}
          onChange={(q) => {
            setQuery(q);
            setLimit(PAGE);
          }}
          label="Search history"
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={source}
          aria-label="Source"
          onChange={(_, v: Source | null) => {
            if (v) {
              setSource(v);
              setLimit(PAGE);
            }
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="tool">Tools</ToggleButton>
          <ToggleButton value="api">API requests</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          select
          size="small"
          label="Module"
          value={moduleId}
          onChange={(e) => {
            setModuleId(TOOL_MODULES.find((m) => m.id === e.target.value)?.id ?? '');
            setLimit(PAGE);
          }}
          sx={{ width: 200 }}
        >
          <MenuItem value="">All modules</MenuItem>
          {TOOL_MODULES.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.title}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {filtered.length} of {total} entries
        </Typography>
      </Stack>
      {all !== undefined && filtered.length === 0 ? (
        <EmptyState
          title={total ? 'No matching entries' : 'No history yet'}
          description={
            total
              ? 'Change the search or filters.'
              : 'Results you copy or download in the tools, and API requests you send, appear here so you can restore them.'
          }
        />
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            minHeight: { md: 520 },
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              width: { md: 380 },
              flexShrink: 0,
              borderRadius: 2.5,
              overflow: 'auto',
              maxHeight: { xs: 360, md: 640 },
            }}
          >
            <List dense aria-label="History entries">
              {filtered.slice(0, limit).map((e) => {
                const tool = e.kind === 'tool' ? getTool(e.row.toolId) : undefined;
                return (
                  <ListItemButton
                    key={e.id}
                    selected={e.id === selected?.id}
                    onClick={() => {
                      setSelectedId(e.id);
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {tool ? (
                        <ToolIcon tool={tool} size={18} />
                      ) : (
                        <Global size={18} color="currentColor" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={e.kind === 'tool' ? e.row.label : `${e.row.method} ${e.row.url}`}
                      secondary={`${e.kind === 'tool' ? toolTitle(e.row.toolId) : 'API request'} · ${formatDistanceToNowStrict(e.at, { addSuffix: true })}`}
                      slotProps={{
                        primary: {
                          noWrap: true,
                          variant: 'body2',
                          sx: e.kind === 'api' ? { fontFamily: fontFamilies.mono } : undefined,
                        },
                        secondary: { noWrap: true },
                      }}
                    />
                    {e.kind === 'api' && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={
                          e.row.status === null
                            ? 'error'
                            : e.row.status >= 400
                              ? 'warning'
                              : 'success'
                        }
                        label={e.row.status === null ? 'Failed' : String(e.row.status)}
                        sx={{ ml: 1 }}
                      />
                    )}
                  </ListItemButton>
                );
              })}
            </List>
            {filtered.length > limit && (
              <Box sx={{ p: 1, textAlign: 'center' }}>
                <Button
                  size="small"
                  onClick={() => {
                    setLimit((l) => l + PAGE);
                  }}
                >
                  Show more ({filtered.length - limit} left)
                </Button>
              </Box>
            )}
          </Paper>
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              minWidth: 0,
              borderRadius: 2.5,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {selected?.kind === 'tool' && (
              <ToolDetail
                key={selected.id}
                row={selected.row}
                onDelete={() => void remove(selected)}
              />
            )}
            {selected?.kind === 'api' && (
              <ApiDetail
                key={selected.id}
                row={selected.row}
                onDelete={() => void remove(selected)}
              />
            )}
          </Paper>
        </Box>
      )}
    </PageContainer>
  );
}
