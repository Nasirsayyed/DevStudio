import { Box, Chip, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import { Panel } from '@/components';
import { DataGrid } from '@/components/data-display/DataGrid';
import { JsonViewer } from '@/components/data-display/JsonViewer';
import { ValidationError } from '@/core/errors/AppError';
import { toJsonPath } from '@/core/json/path';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import type { SearchMatch } from '@/core/json/search';
import type { PathSegment } from '@/core/json/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { JsonToolLayout } from '../components/JsonToolLayout';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { OperationStatusView } from '@/components/workspace/OperationStatusView';
import { parseErrorFor, useJsonOperation } from '../hooks/useJsonOperation';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

export default function JsonSearchPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<{
    scope: 'both' | 'keys' | 'values';
    mode: 'contains' | 'exact' | 'regex';
    caseSensitive: boolean;
  }>('json.search', { scope: 'both', mode: 'contains', caseSensitive: false });
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 200);
  const payload = useMemo(
    () =>
      input.trim() && debounced
        ? {
            text: input,
            options: {
              query: debounced,
              scope: opts.scope,
              mode: opts.mode,
              caseSensitive: opts.caseSensitive,
              limit: 5000,
            },
          }
        : null,
    [input, debounced, opts.scope, opts.mode, opts.caseSensitive],
  );
  const search = useJsonOperation('search', payload);
  // The tree shows the full document; parsed separately so it is available before searching.
  const parsePayload = useMemo(() => (input.trim() ? { text: input } : null), [input]);
  const parsed = useJsonOperation('parse', parsePayload);
  const [selected, setSelected] = useState<PathSegment[] | null>(null);
  const queryError = search.error instanceof ValidationError ? search.error.message : null;

  return (
    <JsonToolLayout
      toolId="json.search"
      sample={SAMPLE_ORDER_JSON}
      inputError={parseErrorFor(parsed.error)}
      inputValid={parsed.status === 'success'}
      onRun={search.run}
      toolbar={
        <OptionsBar>
          <TextField
            size="small"
            label="Search for"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            error={queryError !== null}
            helperText={queryError ?? undefined}
            sx={{ flex: '1 1 240px', maxWidth: 360 }}
            slotProps={{ htmlInput: { 'aria-label': 'Search for' } }}
          />
          <SelectOption
            label="In"
            value={opts.scope}
            options={[
              { value: 'both', label: 'Keys & values' },
              { value: 'keys', label: 'Keys only' },
              { value: 'values', label: 'Values only' },
            ]}
            onChange={(scope) => {
              setOpts({ scope });
            }}
          />
          <SelectOption
            label="Match"
            value={opts.mode}
            options={[
              { value: 'contains', label: 'Contains' },
              { value: 'exact', label: 'Exact' },
              { value: 'regex', label: 'Regular expression' },
            ]}
            onChange={(mode) => {
              setOpts({ mode });
            }}
            width={180}
          />
          <SwitchOption
            label="Case sensitive"
            checked={opts.caseSensitive}
            onChange={(caseSensitive) => {
              setOpts({ caseSensitive });
            }}
          />
        </OptionsBar>
      }
    >
      <Panel
        title="Results"
        busy={search.status === 'running'}
        meta={
          search.result && debounced ? (
            <Chip
              size="small"
              label={`${search.result.matches.length}${search.result.truncated ? '+' : ''} matches`}
              sx={{ height: 20, fontSize: 11 }}
            />
          ) : undefined
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <Box
            sx={{ flex: '0 0 40%', minHeight: 160, p: 1, display: 'flex', flexDirection: 'column' }}
          >
            {debounced ? (
              <OperationStatusView
                state={search}
                emptyHint="Type a search term above."
                queryErrorHint="Fix the search pattern above to see results."
              >
                {(result) => (
                  <DataGrid<SearchMatch>
                    ariaLabel="Search results"
                    rows={result.matches}
                    rowKey={(m, i) => `${toJsonPath(m.path)}:${m.matchedOn}:${i}`}
                    onRowClick={(m) => {
                      setSelected(m.path);
                    }}
                    emptyMessage="No matches."
                    columns={[
                      {
                        id: 'path',
                        header: 'Path',
                        getValue: (m) => toJsonPath(m.path),
                        mono: true,
                      },
                      { id: 'on', header: 'Matched', width: 90, getValue: (m) => m.matchedOn },
                      { id: 'type', header: 'Type', width: 90, getValue: (m) => m.type },
                      { id: 'value', header: 'Value', getValue: (m) => m.preview, mono: true },
                    ]}
                  />
                )}
              </OperationStatusView>
            ) : (
              <OperationStatusView
                state={{ ...parsed, result: undefined, status: 'idle', stale: false }}
                emptyHint="Type a search term above. Click a result to reveal it in the tree."
              >
                {() => null}
              </OperationStatusView>
            )}
          </Box>
          <Box sx={{ flex: 1, minHeight: 200, borderTop: 1, borderColor: 'divider' }}>
            {parsed.result !== undefined && (
              <JsonViewer
                value={parsed.result}
                ariaLabel="Document tree"
                selectedPath={selected}
                onSelect={setSelected}
                highlight={opts.mode === 'regex' ? '' : debounced}
              />
            )}
          </Box>
        </Box>
      </Panel>
    </JsonToolLayout>
  );
}
