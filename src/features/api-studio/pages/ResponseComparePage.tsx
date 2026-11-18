import {
  Alert,
  Box,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CodeEditor, DiffEditor, EmptyState, ToolWorkspace } from '@/components';
import { SwitchOption } from '@/components/workspace/OptionControls';
import { compareResponses, type ResponseSide } from '@/core/http/compare';
import { toJsonPath } from '@/core/json/path';
import {
  type ApiHistorySnapshot,
  apiHistoryRepository,
} from '@/services/db/repositories/apiHistoryRepository';
import { fontFamilies } from '@/theme/tokens';
import { requireTool } from '@/tools/toolRegistry';
import type { ApiHistoryEntity } from '@/types/entities';

const PASTE = '__paste__';
const MAX_PASTE = 5_000_000;

function sideOf(entry: ApiHistoryEntity): ResponseSide | null {
  const r = (entry.snapshot as unknown as ApiHistorySnapshot).response;
  if (!r) return null;
  return {
    status: r.status,
    durationMs: r.durationMs,
    sizeBytes: r.sizeBytes,
    contentType: r.contentType,
    headers: r.headers,
    body: r.body,
  };
}

const pasted = (text: string): ResponseSide => ({
  status: null,
  durationMs: null,
  sizeBytes: new TextEncoder().encode(text).length,
  contentType: '',
  headers: [],
  body: text,
});

function SidePicker({
  label,
  value,
  onChange,
  entries,
  text,
  onText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  entries: readonly ApiHistoryEntity[];
  text: string;
  onText: (t: string) => void;
}) {
  return (
    <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
      <TextField
        select
        size="small"
        label={label}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        <MenuItem value={PASTE}>Paste a response body…</MenuItem>
        {entries.map((h) => (
          <MenuItem key={h.id} value={h.id} sx={{ fontFamily: fontFamilies.mono, fontSize: 13 }}>
            {`${String(h.status)} ${h.method} ${h.url.length > 70 ? `${h.url.slice(0, 70)}…` : h.url} · ${formatDistanceToNowStrict(h.createdAt, { addSuffix: true })}`}
          </MenuItem>
        ))}
      </TextField>
      {value === PASTE && (
        <Box
          sx={{
            height: 160,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1.5,
            overflow: 'hidden',
          }}
        >
          <CodeEditor
            value={text}
            onChange={(t) => {
              onText(t.slice(0, MAX_PASTE));
            }}
            language="json"
            ariaLabel={`${label} body`}
          />
        </Box>
      )}
    </Stack>
  );
}

export default function ResponseComparePage() {
  const tool = requireTool('api.compare');
  const [params] = useSearchParams();
  const entries = useLiveQuery(
    async () => (await apiHistoryRepository.list({}, 200)).filter((h) => h.status !== null),
    [],
  );
  const [left, setLeft] = useState(params.get('left') ?? PASTE);
  const [right, setRight] = useState(params.get('right') ?? PASTE);
  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');
  const [ignoreKeyOrder, setIgnoreKeyOrder] = useState(true);
  const [ignoreVolatile, setIgnoreVolatile] = useState(true);
  const [unordered, setUnordered] = useState(false);
  const [tab, setTab] = useState(0);

  const comparison = useMemo(() => {
    const resolve = (id: string, text: string): ResponseSide | null => {
      if (id === PASTE) return text.trim() ? pasted(text) : null;
      const e = entries?.find((h) => h.id === id);
      return e ? sideOf(e) : null;
    };
    const a = resolve(left, leftText);
    const b = resolve(right, rightText);
    return a && b
      ? compareResponses(a, b, {
          ignoreKeyOrder,
          ignoreVolatileHeaders: ignoreVolatile,
          arrayMode: unordered ? 'unordered' : 'index',
        })
      : null;
  }, [left, right, leftText, rightText, entries, ignoreKeyOrder, ignoreVolatile, unordered]);
  const bodyEqual = comparison
    ? comparison.body.kind === 'json'
      ? comparison.body.diff.equal
      : comparison.body.equal
    : false;
  const headerChanges = comparison?.headers.filter((h) => h.kind !== 'same').length ?? 0;

  return (
    <ToolWorkspace
      tool={tool}
      toolbar={
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <SwitchOption
            label="Ignore key order"
            checked={ignoreKeyOrder}
            onChange={setIgnoreKeyOrder}
          />
          <SwitchOption label="Arrays in any order" checked={unordered} onChange={setUnordered} />
          <SwitchOption
            label="Ignore volatile headers (Date, ETag…)"
            checked={ignoreVolatile}
            onChange={setIgnoreVolatile}
          />
        </Stack>
      }
    >
      <Stack spacing={2} sx={{ p: { xs: 1.5, sm: 2 }, flex: 1, minHeight: 0 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <SidePicker
            label="Left response"
            value={left}
            onChange={setLeft}
            entries={entries ?? []}
            text={leftText}
            onText={setLeftText}
          />
          <SidePicker
            label="Right response"
            value={right}
            onChange={setRight}
            entries={entries ?? []}
            text={rightText}
            onText={setRightText}
          />
        </Stack>
        {!comparison ? (
          <EmptyState
            dense
            title="Choose two responses"
            description={
              entries?.length
                ? 'Pick responses from the request history or paste bodies.'
                : 'Send requests in the Request Builder (they appear in the history) or paste two response bodies.'
            }
          />
        ) : (
          <Paper
            component="section"
            aria-label="Comparison"
            variant="outlined"
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 2.5,
              overflow: 'hidden',
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ alignItems: 'center', p: 1.5, flexWrap: 'wrap' }}
              role="status"
              aria-label="Comparison summary"
            >
              <Chip
                size="small"
                color={bodyEqual ? 'success' : 'warning'}
                label={bodyEqual ? 'Bodies are equal' : 'Bodies differ'}
              />
              {comparison.body.kind === 'json' && !bodyEqual && (
                <Typography variant="body2" color="text.secondary">
                  {comparison.body.diff.summary.added} added ·{' '}
                  {comparison.body.diff.summary.removed} removed ·{' '}
                  {comparison.body.diff.summary.changed +
                    comparison.body.diff.summary['type-changed']}{' '}
                  changed
                </Typography>
              )}
              <Chip
                size="small"
                variant="outlined"
                label={`${String(headerChanges)} header difference(s)`}
              />
              {comparison.meta
                .filter((m) => m.different)
                .map((m) => (
                  <Chip
                    key={m.label}
                    size="small"
                    variant="outlined"
                    color="warning"
                    label={`${m.label}: ${m.left} → ${m.right}`}
                  />
                ))}
            </Stack>
            <Tabs
              value={tab}
              onChange={(_, v: number) => {
                setTab(v);
              }}
              sx={{ px: 1.5, minHeight: 40, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Body" sx={{ minHeight: 40 }} />
              <Tab
                label={
                  comparison.body.kind === 'json'
                    ? `Differences (${String(comparison.body.diff.entries.length)})`
                    : 'Differences'
                }
                sx={{ minHeight: 40 }}
                disabled={comparison.body.kind !== 'json'}
              />
              <Tab label="Headers" sx={{ minHeight: 40 }} />
            </Tabs>
            <Box sx={{ flex: 1, minHeight: 320, display: 'flex', flexDirection: 'column' }}>
              {tab === 0 && (
                <DiffEditor
                  original={comparison.body.left}
                  modified={comparison.body.right}
                  language={comparison.body.kind === 'json' ? 'json' : 'plaintext'}
                  ariaLabel="Body differences"
                />
              )}
              {tab === 1 && comparison.body.kind === 'json' && (
                <Box sx={{ overflow: 'auto' }}>
                  {comparison.body.diff.truncated && (
                    <Alert severity="info" sx={{ m: 1.5 }}>
                      Only the first 1000 differences are listed.
                    </Alert>
                  )}
                  <Table size="small" aria-label="JSON differences">
                    <TableHead>
                      <TableRow>
                        <TableCell>Path</TableCell>
                        <TableCell>Change</TableCell>
                        <TableCell>Left</TableCell>
                        <TableCell>Right</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comparison.body.diff.entries.map((d) => {
                        const path = toJsonPath(d.path);
                        return (
                          <TableRow key={`${path}-${d.kind}`}>
                            <TableCell sx={{ fontFamily: fontFamilies.mono }}>{path}</TableCell>
                            <TableCell>{d.kind}</TableCell>
                            <TableCell
                              sx={{ fontFamily: fontFamilies.mono, overflowWrap: 'anywhere' }}
                            >
                              {d.left === undefined ? '' : JSON.stringify(d.left).slice(0, 200)}
                            </TableCell>
                            <TableCell
                              sx={{ fontFamily: fontFamilies.mono, overflowWrap: 'anywhere' }}
                            >
                              {d.right === undefined ? '' : JSON.stringify(d.right).slice(0, 200)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              )}
              {tab === 2 && (
                <Box sx={{ overflow: 'auto' }}>
                  <Table size="small" aria-label="Header differences">
                    <TableHead>
                      <TableRow>
                        <TableCell>Header</TableCell>
                        <TableCell>Left</TableCell>
                        <TableCell>Right</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[
                        ...comparison.meta.map((m) => ({
                          name: m.label,
                          left: m.left,
                          right: m.right,
                          kind: m.different ? 'changed' : 'same',
                        })),
                        ...comparison.headers,
                      ].map((h) => (
                        <TableRow
                          key={h.name}
                          sx={{ bgcolor: h.kind === 'same' ? undefined : 'action.hover' }}
                        >
                          <TableCell sx={{ fontFamily: fontFamilies.mono, fontWeight: 600 }}>
                            {h.name}{' '}
                            {h.kind !== 'same' && (
                              <Chip size="small" label={h.kind} sx={{ ml: 1 }} />
                            )}
                          </TableCell>
                          <TableCell
                            sx={{ fontFamily: fontFamilies.mono, overflowWrap: 'anywhere' }}
                          >
                            {h.left ?? '—'}
                          </TableCell>
                          <TableCell
                            sx={{ fontFamily: fontFamilies.mono, overflowWrap: 'anywhere' }}
                          >
                            {h.right ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', p: 1.5 }}
                  >
                    Pasted bodies have no status or headers. History keeps headers the browser
                    exposed (CORS), with credentials redacted.
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        )}
      </Stack>
    </ToolWorkspace>
  );
}
