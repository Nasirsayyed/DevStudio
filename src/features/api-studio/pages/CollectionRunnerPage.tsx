import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, Play, Stop } from 'iconsax-reactjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { EmptyState, ToolWorkspace, useNotify } from '@/components';
import { SwitchOption } from '@/components/workspace/OptionControls';
import { toUserMessage } from '@/core/errors/AppError';
import { apiCollectionsRepository } from '@/services/db/repositories/apiCollectionsRepository';
import { downloadText } from '@/services/files/textFiles';
import { useApiWorkspaceStore } from '@/stores/apiWorkspaceStore';
import { fontFamilies } from '@/theme/tokens';
import { requireTool } from '@/tools/toolRegistry';
import { EnvironmentSelect } from '../components/EnvironmentSelect';
import { TestResults } from '../components/TestResults';
import { useVariableScopes } from '../hooks';
import { type RunResult, runCollection, runReport } from '../runner';

const clamp = (n: number, lo: number, hi: number) =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : lo;

function ResultRow({
  r,
  selected,
  onSelect,
}: {
  r: RunResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const passedTests = r.tests.filter((t) => t.passed).length;
  return (
    <ListItemButton
      selected={selected}
      onClick={onSelect}
      aria-label={`${r.passed ? 'Passed' : 'Failed'}: ${r.name}`}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          mr: 1.5,
          bgcolor: r.passed ? 'success.main' : 'error.main',
        }}
      />
      <ListItemText
        primary={r.name}
        secondary={
          r.error
            ? r.error.slice(0, 120)
            : `${r.method} · ${r.timeMs === null ? '' : `${String(r.timeMs)} ms`}${r.tests.length ? ` · ${String(passedTests)}/${String(r.tests.length)} assertions` : ''}`
        }
        slotProps={{ primary: { noWrap: true, variant: 'body2' }, secondary: { noWrap: true } }}
      />
      <Chip
        size="small"
        variant="outlined"
        color={r.status === null ? 'error' : r.status >= 400 ? 'warning' : 'success'}
        label={r.status === null ? 'Error' : String(r.status)}
        sx={{ ml: 1 }}
      />
    </ListItemButton>
  );
}

export default function CollectionRunnerPage() {
  const tool = requireTool('api.runner');
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const collections = useLiveQuery(() => apiCollectionsRepository.listCollections(), []);
  const [chosen, setChosen] = useState<string | null>(params.get('collection'));
  const collectionId = collections?.some((c) => c.id === chosen)
    ? chosen
    : (collections?.[0]?.id ?? null);
  const collection = collections?.find((c) => c.id === collectionId);
  const ordered = useLiveQuery(
    () =>
      collectionId ? apiCollectionsRepository.runOrder(collectionId) : Promise.resolve(undefined),
    [collectionId, collection?.updatedAt],
  );
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [iterations, setIterations] = useState(1);
  const [delayMs, setDelayMs] = useState(0);
  const [stopOnFailure, setStopOnFailure] = useState(false);
  const [useRuntime, setUseRuntime] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const { scopes, secrets } = useVariableScopes(collectionId);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!params.has('collection')) return;
    setParams(
      (p) => {
        p.delete('collection');
        return p;
      },
      { replace: true },
    );
  }, [params, setParams]);

  const items = useMemo(
    () => (ordered ?? []).filter((r) => !excluded.has(r.id)),
    [ordered, excluded],
  );
  const total = items.length * iterations;

  const move = (index: number, delta: number) => {
    if (!ordered || !collectionId) return;
    const ids = ordered.map((r) => r.id);
    const [id] = ids.splice(index, 1);
    if (id === undefined) return;
    ids.splice(index + delta, 0, id);
    apiCollectionsRepository.setRunOrder(collectionId, ids).catch((error: unknown) => {
      notify.error(toUserMessage(error));
    });
  };

  const run = async () => {
    if (!collection || items.length === 0) return;
    const c = new AbortController();
    controller.current = c;
    setRunning(true);
    setResults([]);
    setSelectedKey(null);
    setOutcome(null);
    try {
      const summary = await runCollection({
        items: items.map((r) => ({ id: r.id, draft: apiCollectionsRepository.draftOf(r) })),
        // scopes[0] is the builder's runtime map; the run keeps its own (optionally seeded from it).
        scopes: scopes.slice(1),
        runtime: useRuntime ? useApiWorkspaceStore.getState().runtime : {},
        secrets,
        iterations,
        delayMs,
        stopOnFailure,
        signal: c.signal,
        onResult: (r) => {
          setResults((prev) => [...prev, r]);
        },
      });
      setOutcome(
        summary.stopped === 'cancelled'
          ? 'The run was stopped.'
          : summary.stopped === 'failure'
            ? 'Stopped at the first failure.'
            : 'Run finished.',
      );
    } catch (error) {
      notify.error(toUserMessage(error));
    } finally {
      setRunning(false);
    }
  };

  const passed = results.filter((r) => r.passed).length;
  const selected = results.find((r) => r.key === selectedKey) ?? null;

  if (collections?.length === 0)
    return (
      <ToolWorkspace tool={tool}>
        <EmptyState
          title="No collections yet"
          description="Save requests into a collection in the Request Builder, or import a DevStudio or Postman collection there."
        />
      </ToolWorkspace>
    );

  return (
    <ToolWorkspace
      tool={tool}
      toolbar={
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <TextField
            select
            size="small"
            label="Collection"
            value={collectionId ?? ''}
            onChange={(e) => {
              setChosen(e.target.value);
              setExcluded(new Set());
            }}
            sx={{ width: 220 }}
            disabled={running}
          >
            {(collections ?? []).map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <EnvironmentSelect />
          <TextField
            size="small"
            type="number"
            label="Iterations"
            value={iterations}
            onChange={(e) => {
              setIterations(clamp(Number(e.target.value), 1, 100));
            }}
            sx={{ width: 100 }}
            disabled={running}
          />
          <TextField
            size="small"
            type="number"
            label="Delay (ms)"
            value={delayMs}
            onChange={(e) => {
              setDelayMs(clamp(Number(e.target.value), 0, 60_000));
            }}
            sx={{ width: 110 }}
            disabled={running}
          />
          <SwitchOption
            label="Stop on failure"
            checked={stopOnFailure}
            onChange={setStopOnFailure}
          />
          <SwitchOption
            label="Start with runtime variables"
            checked={useRuntime}
            onChange={setUseRuntime}
          />
          <Box sx={{ flex: 1 }} />
          {running ? (
            <Button
              color="error"
              variant="outlined"
              startIcon={<Stop size={16} color="currentColor" />}
              onClick={() => controller.current?.abort()}
            >
              Stop
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<Play size={16} color="currentColor" />}
              disabled={items.length === 0}
              onClick={() => void run()}
            >
              Run {items.length > 0 ? `(${String(total)})` : ''}
            </Button>
          )}
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
        <Paper
          variant="outlined"
          sx={{
            width: { md: 320 },
            flexShrink: 0,
            borderRadius: 2.5,
            overflow: 'auto',
            maxHeight: { xs: 320, md: 'none' },
          }}
        >
          <Typography variant="subtitle2" component="h2" sx={{ px: 1.5, pt: 1.5 }}>
            Run order
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, display: 'block' }}>
            Requests run top to bottom; values extracted by one are available to the next.
          </Typography>
          {ordered?.length === 0 ? (
            <EmptyState
              dense
              title="No requests"
              description="This collection has no saved requests."
            />
          ) : (
            <List dense aria-label="Run order">
              {(ordered ?? []).map((r, i) => (
                <ListItem
                  key={r.id}
                  disablePadding
                  sx={{ pl: 0.5, pr: 0.5 }}
                  secondaryAction={
                    <Stack direction="row">
                      <IconButton
                        size="small"
                        aria-label={`Move ${r.name} up`}
                        disabled={i === 0 || running}
                        onClick={() => {
                          move(i, -1);
                        }}
                      >
                        <ArrowUp size={14} color="currentColor" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Move ${r.name} down`}
                        disabled={i === (ordered?.length ?? 0) - 1 || running}
                        onClick={() => {
                          move(i, 1);
                        }}
                      >
                        <ArrowDown size={14} color="currentColor" />
                      </IconButton>
                    </Stack>
                  }
                >
                  <Checkbox
                    size="small"
                    checked={!excluded.has(r.id)}
                    disabled={running}
                    onChange={(e) => {
                      setExcluded((s) => {
                        const next = new Set(s);
                        if (e.target.checked) next.delete(r.id);
                        else next.add(r.id);
                        return next;
                      });
                    }}
                    slotProps={{ input: { 'aria-label': `Include ${r.name}` } }}
                  />
                  <Typography
                    component="span"
                    sx={{
                      width: 56,
                      flexShrink: 0,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: fontFamilies.mono,
                    }}
                  >
                    {r.method}
                  </Typography>
                  <ListItemText
                    primary={r.name}
                    slotProps={{ primary: { noWrap: true, variant: 'body2' } }}
                    sx={{ pr: 7 }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
        <Paper
          component="section"
          aria-label="Run results"
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
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}
          >
            <Typography variant="subtitle2" component="h2" sx={{ flex: 1 }} aria-live="polite">
              {results.length === 0 && !running
                ? 'Results'
                : `${String(passed)} passed · ${String(results.length - passed)} failed · ${String(results.length)}/${String(total)}`}
            </Typography>
            <Button
              size="small"
              disabled={results.length === 0 || running}
              onClick={() => {
                downloadText(
                  runReport(collection?.name ?? 'collection', results, secrets),
                  'run-results.json',
                  'application/json',
                );
              }}
            >
              Export results
            </Button>
          </Stack>
          {running && (
            <LinearProgress
              variant="determinate"
              value={total ? (results.length / total) * 100 : 0}
              aria-label="Run progress"
            />
          )}
          {outcome && (
            <Alert
              severity={
                results.every((r) => r.passed) && outcome === 'Run finished.' ? 'success' : 'info'
              }
              sx={{ m: 1.5, mb: 0 }}
            >
              {outcome}
            </Alert>
          )}
          {results.length === 0 && !running ? (
            <EmptyState
              dense
              title="Not run yet"
              description="Choose the requests and press Run. Requests are sent from your browser; APIs must allow this site with CORS. Run results are not added to the request history."
            />
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', lg: 'row' },
                flex: 1,
                minHeight: 0,
              }}
            >
              <List dense aria-label="Results" sx={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
                {results.map((r) => (
                  <Box key={r.key}>
                    {iterations > 1 && r === results.find((x) => x.iteration === r.iteration) && (
                      <Typography variant="overline" sx={{ px: 2, display: 'block' }}>
                        Iteration {r.iteration}
                      </Typography>
                    )}
                    <ResultRow
                      r={r}
                      selected={r.key === selectedKey}
                      onSelect={() => {
                        setSelectedKey(r.key);
                      }}
                    />
                  </Box>
                ))}
              </List>
              {selected && (
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    borderLeft: { lg: 1 },
                    borderTop: { xs: 1, lg: 0 },
                    borderColor: 'divider',
                    overflow: 'auto',
                  }}
                  aria-label="Result details"
                  role="region"
                >
                  <Typography
                    sx={{ fontFamily: fontFamilies.mono, p: 1.5, pb: 0, overflowWrap: 'anywhere' }}
                    variant="body2"
                  >
                    <strong>{selected.method}</strong> {selected.url}
                  </Typography>
                  {selected.error && (
                    <Alert severity="error" sx={{ m: 1.5, mb: 0 }}>
                      {selected.error}
                    </Alert>
                  )}
                  {selected.warnings.map((w) => (
                    <Alert key={w} severity="info" sx={{ m: 1.5, mb: 0, py: 0 }}>
                      {w}
                    </Alert>
                  ))}
                  {selected.tests.length === 0 && !selected.extracted && !selected.error && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
                      This request has no assertions. Add them in the Request Builder&apos;s Tests
                      tab.
                    </Typography>
                  )}
                  <TestResults
                    tests={selected.tests}
                    extracted={selected.extracted}
                    label="Assertion results"
                  />
                </Box>
              )}
            </Box>
          )}
        </Paper>
      </Box>
    </ToolWorkspace>
  );
}
