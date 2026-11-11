import { Box, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { CopyButton, EmptyState, Panel } from '@/components';
import { JsonViewer } from '@/components/data-display/JsonViewer';
import { formatJson } from '@/core/json/format';
import { getAtPath, toJsAccessor, toJsonPath, toJsonPointer } from '@/core/json/path';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import type { JsonValue, PathSegment } from '@/core/json/types';
import { fontFamilies } from '@/theme/tokens';
import { JsonToolLayout } from '../components/JsonToolLayout';
import { OperationStatusView } from '../components/StatusViews';
import { parseErrorFor, useJsonOperation } from '../hooks/useJsonOperation';
import { useJsonStudioStore } from '../store';

function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="caption" color="text.secondary" sx={{ width: 96, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box
        component="code"
        aria-label={label}
        sx={{
          flex: 1,
          minWidth: 0,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: 'background.sunken',
          fontFamily: fontFamilies.mono,
          fontSize: 12.5,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </Box>
      <CopyButton value={value} label={`Copy ${label}`} />
    </Stack>
  );
}

const PREVIEW_LIMIT = 20_000;

function SelectionDetails({ root, path }: { root: JsonValue; path: PathSegment[] }) {
  const value = getAtPath(root, path);
  const text = value === undefined ? '' : formatJson(value);
  return (
    <Stack spacing={1} sx={{ p: 1.5 }}>
      <PathRow label="JSONPath" value={toJsonPath(path)} />
      <PathRow label="JavaScript" value={toJsAccessor(path)} />
      <PathRow label="JSON Pointer" value={toJsonPointer(path) || '/'} />
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Value
        </Typography>
        <CopyButton value={text} label="Copy value" />
      </Stack>
      <Box
        component="pre"
        aria-label="Selected value"
        sx={{
          m: 0,
          p: 1,
          maxHeight: 160,
          overflow: 'auto',
          borderRadius: 1,
          bgcolor: 'background.sunken',
          fontFamily: fontFamilies.mono,
          fontSize: 12,
        }}
      >
        {text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT)}\n…` : text}
      </Box>
    </Stack>
  );
}

export default function JsonPathFinderPage() {
  const input = useJsonStudioStore((s) => s.input);
  const payload = useMemo(() => (input.trim() ? { text: input } : null), [input]);
  const state = useJsonOperation('parse', payload);
  const [selected, setSelected] = useState<PathSegment[] | null>(null);
  const [prevResult, setPrevResult] = useState(state.result);
  if (prevResult !== state.result) {
    setPrevResult(state.result);
    setSelected(null);
  }
  return (
    <JsonToolLayout
      toolId="json.path-finder"
      sample={SAMPLE_ORDER_JSON}
      inputError={parseErrorFor(state.error)}
      inputValid={state.status === 'success'}
      onRun={state.run}
    >
      <Panel title="Select a node" busy={state.status === 'running'}>
        <OperationStatusView
          state={state}
          emptyHint="Paste, type, drop or open JSON on the left, then click any node to get its path."
        >
          {(value) => (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              <Box sx={{ flex: 1, minHeight: 200 }}>
                <JsonViewer
                  value={value}
                  ariaLabel="JSON tree"
                  selectedPath={selected}
                  onSelect={setSelected}
                  defaultExpandDepth={2}
                />
              </Box>
              <Box sx={{ borderTop: 1, borderColor: 'divider' }} aria-live="polite">
                {selected ? (
                  <SelectionDetails root={value} path={selected} />
                ) : (
                  <EmptyState
                    dense
                    title="No node selected"
                    description="Click a node (or use ↑ ↓ and Enter) to see its JSONPath, JavaScript accessor and JSON Pointer."
                  />
                )}
              </Box>
            </Box>
          )}
        </OperationStatusView>
      </Panel>
    </JsonToolLayout>
  );
}
