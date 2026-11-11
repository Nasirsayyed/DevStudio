import { Alert, Box, Chip, Stack, Tab, Tabs } from '@mui/material';
import { useMemo, useState } from 'react';
import { DiffEditor, Panel } from '@/components';
import { DataGrid } from '@/components/data-display/DataGrid';
import type { DiffEntry, DiffKind } from '@/core/json/diff';
import { toJsonPath } from '@/core/json/path';
import { SAMPLE_ORDER_JSON, SAMPLE_ORDER_JSON_V2 } from '@/core/json/samples';
import { previewValue } from '@/core/json/search';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { DualInputLayout } from '../components/DualInputLayout';
import { JsonInputPanel } from '@/components/workspace/JsonInputPanel';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { OperationStatusView } from '@/components/workspace/OperationStatusView';
import { parseErrorFor, useJsonOperation } from '../hooks/useJsonOperation';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

const KIND_META: Record<
  DiffKind,
  { label: string; color: 'success' | 'error' | 'warning' | 'info' }
> = {
  added: { label: 'Added', color: 'success' },
  removed: { label: 'Missing', color: 'error' },
  changed: { label: 'Changed', color: 'warning' },
  'type-changed': { label: 'Type differs', color: 'info' },
};

export default function JsonComparePage() {
  const left = useJsonWorkspaceStore((s) => s.input);
  const right = useJsonWorkspaceStore((s) => s.secondary);
  const setLeft = useJsonWorkspaceStore((s) => s.setInput);
  const setRight = useJsonWorkspaceStore((s) => s.setSecondary);
  const [opts, setOpts] = usePersistentOptions<{
    arrayMode: 'index' | 'unordered';
    normalize: boolean;
    sideBySide: boolean;
  }>('json.compare', { arrayMode: 'index', normalize: true, sideBySide: true });
  const payload = useMemo(
    () =>
      left.trim() && right.trim()
        ? {
            left,
            right,
            options: { arrayMode: opts.arrayMode, maxEntries: 5000 },
            normalize: opts.normalize,
          }
        : null,
    [left, right, opts.arrayMode, opts.normalize],
  );
  const state = useJsonOperation('diff', payload);
  const [tab, setTab] = useState(0);

  return (
    <DualInputLayout
      toolId="json.compare"
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Arrays"
            value={opts.arrayMode}
            options={[
              { value: 'index', label: 'Compare by position' },
              { value: 'unordered', label: 'Ignore order' },
            ]}
            onChange={(arrayMode) => {
              setOpts({ arrayMode });
            }}
            width={220}
          />
          <SwitchOption
            label="Sort keys in text diff"
            checked={opts.normalize}
            onChange={(normalize) => {
              setOpts({ normalize });
            }}
          />
          <SwitchOption
            label="Side by side"
            checked={opts.sideBySide}
            onChange={(sideBySide) => {
              setOpts({ sideBySide });
            }}
          />
        </OptionsBar>
      }
      first={
        <JsonInputPanel
          title="Left (original)"
          value={left}
          onChange={setLeft}
          documents
          sample={SAMPLE_ORDER_JSON}
          error={parseErrorFor(state.error, 'left')}
          onRun={state.run}
        />
      }
      second={
        <JsonInputPanel
          title="Right (changed)"
          value={right}
          onChange={setRight}
          sample={SAMPLE_ORDER_JSON_V2}
          error={parseErrorFor(state.error, 'right')}
          onRun={state.run}
        />
      }
      results={
        <Panel
          title="Differences"
          busy={state.status === 'running'}
          meta={
            state.result && !state.result.equal ? (
              <Stack direction="row" spacing={0.5} aria-label="Difference summary">
                {(Object.keys(KIND_META) as DiffKind[]).map((k) =>
                  state.result && state.result.summary[k] > 0 ? (
                    <Chip
                      key={k}
                      size="small"
                      color={KIND_META[k].color}
                      variant="outlined"
                      label={`${KIND_META[k].label}: ${state.result.summary[k]}`}
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  ) : null,
                )}
              </Stack>
            ) : undefined
          }
        >
          <OperationStatusView
            state={state}
            emptyHint="Paste or open JSON in both editors above to compare them structurally."
          >
            {(result) =>
              result.equal ? (
                <Alert severity="success" role="status" sx={{ m: 1.5, borderRadius: 2 }}>
                  The documents are structurally identical
                  {opts.arrayMode === 'unordered' ? ' (ignoring array order)' : ''}. Key order and
                  formatting are not significant.
                </Alert>
              ) : (
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
                >
                  <Tabs
                    value={tab}
                    onChange={(_, v: number) => {
                      setTab(v);
                    }}
                    sx={{ px: 1, minHeight: 36, '& .MuiTab-root': { minHeight: 36 } }}
                  >
                    <Tab
                      label={`Structural (${result.entries.length}${result.truncated ? '+' : ''})`}
                    />
                    <Tab label="Text diff" />
                  </Tabs>
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      p: tab === 0 ? 1 : 0,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {tab === 0 ? (
                      <DataGrid<DiffEntry>
                        ariaLabel="Structural differences"
                        rows={result.entries}
                        rowKey={(e, i) => `${toJsonPath(e.path)}:${i}`}
                        columns={[
                          {
                            id: 'kind',
                            header: 'Change',
                            width: 130,
                            getValue: (e) => KIND_META[e.kind].label,
                            render: (e) => (
                              <Chip
                                size="small"
                                color={KIND_META[e.kind].color}
                                label={KIND_META[e.kind].label}
                                sx={{ height: 20, fontSize: 11 }}
                              />
                            ),
                          },
                          {
                            id: 'path',
                            header: 'Path',
                            getValue: (e) => toJsonPath(e.path),
                            mono: true,
                          },
                          {
                            id: 'left',
                            header: 'Left',
                            getValue: (e) =>
                              e.kind === 'added'
                                ? '—'
                                : `${previewValue(e.left ?? null)}${e.kind === 'type-changed' ? ` (${e.leftType ?? ''})` : ''}`,
                            mono: true,
                          },
                          {
                            id: 'right',
                            header: 'Right',
                            getValue: (e) =>
                              e.kind === 'removed'
                                ? '—'
                                : `${previewValue(e.right ?? null)}${e.kind === 'type-changed' ? ` (${e.rightType ?? ''})` : ''}`,
                            mono: true,
                          },
                        ]}
                      />
                    ) : (
                      <DiffEditor
                        original={result.leftText}
                        modified={result.rightText}
                        sideBySide={opts.sideBySide}
                        ariaLabel="Text diff"
                      />
                    )}
                  </Box>
                </Box>
              )
            }
          </OperationStatusView>
        </Panel>
      }
    />
  );
}
