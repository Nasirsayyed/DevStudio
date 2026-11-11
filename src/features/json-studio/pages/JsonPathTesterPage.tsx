import { Box, Chip, Stack, Tab, Tabs, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import { CodeEditor, CopyButton, Panel } from '@/components';
import { DataGrid } from '@/components/data-display/DataGrid';
import { DownloadButton } from '@/components/inputs/DownloadButton';
import { ValidationError } from '@/core/errors/AppError';
import { formatJson } from '@/core/json/format';
import type { JsonPathMatch } from '@/core/json/jsonpath';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { previewValue } from '@/core/json/search';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { fontFamilies } from '@/theme/tokens';
import { JsonToolLayout } from '../components/JsonToolLayout';
import { OptionsBar } from '../components/OptionControls';
import { OperationStatusView } from '../components/StatusViews';
import { useHistoryRecorder } from '../hooks/useHistoryRecorder';
import { parseErrorFor, useJsonOperation } from '../hooks/useJsonOperation';
import { useJsonStudioStore } from '../store';

const EXAMPLES = [
  '$.items[*].name',
  '$..sku',
  '$.items[?(@.unit_price > 1000)]',
  '$.items.length',
  '$.shipping_address.*',
];

export default function JsonPathTesterPage() {
  const input = useJsonStudioStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions('json.jsonpath', { expression: '$.items[*].name' });
  const expression = useDebouncedValue(opts.expression, 200);
  const payload = useMemo(
    () => (input.trim() && expression.trim() ? { text: input, expression } : null),
    [input, expression],
  );
  const state = useJsonOperation('jsonPath', payload);
  const [tab, setTab] = useState(0);
  const record = useHistoryRecorder('json.jsonpath');
  const exprError = state.error instanceof ValidationError ? state.error.message : null;

  return (
    <JsonToolLayout
      toolId="json.jsonpath"
      sample={SAMPLE_ORDER_JSON}
      inputError={parseErrorFor(state.error)}
      inputValid={state.status === 'success'}
      onRun={state.run}
      toolbar={
        <OptionsBar>
          <TextField
            size="small"
            label="JSONPath expression"
            value={opts.expression}
            onChange={(e) => {
              setOpts({ expression: e.target.value });
            }}
            error={exprError !== null}
            helperText={exprError ?? undefined}
            sx={{ flex: '1 1 320px', maxWidth: 560 }}
            slotProps={{
              htmlInput: { spellCheck: false, style: { fontFamily: fontFamilies.mono } },
            }}
          />
          <Stack
            direction="row"
            spacing={0.5}
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
            aria-label="Example expressions"
          >
            {EXAMPLES.map((ex) => (
              <Chip
                key={ex}
                size="small"
                variant="outlined"
                label={ex}
                onClick={() => {
                  setOpts({ expression: ex });
                }}
                sx={{ fontFamily: fontFamilies.mono }}
              />
            ))}
          </Stack>
        </OptionsBar>
      }
    >
      <Panel
        title="Matches"
        busy={state.status === 'running'}
        meta={
          state.result ? (
            <Chip
              size="small"
              label={`${state.result.matches.length} match${state.result.matches.length === 1 ? '' : 'es'}`}
              sx={{ height: 20, fontSize: 11 }}
            />
          ) : undefined
        }
        actions={
          state.result ? (
            <>
              <CopyButton
                label="Copy results as JSON"
                value={() => formatJson(state.result?.matches.map((m) => m.value) ?? [])}
                onCopied={() => {
                  record(
                    `JSONPath ${expression}`,
                    input,
                    formatJson(state.result?.matches.map((m) => m.value) ?? []),
                    { expression },
                  );
                }}
              />
              <DownloadButton
                content={() => formatJson(state.result?.matches.map((m) => m.value) ?? [])}
                filename="jsonpath-results.json"
              />
            </>
          ) : undefined
        }
      >
        <OperationStatusView
          state={state}
          emptyHint="Enter JSON on the left and a JSONPath expression above."
          queryErrorHint="Fix the JSONPath expression above to see matches."
        >
          {(result) => (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              <Tabs
                value={tab}
                onChange={(_, v: number) => {
                  setTab(v);
                }}
                sx={{ px: 1, minHeight: 36, '& .MuiTab-root': { minHeight: 36 } }}
              >
                <Tab label="Table" />
                <Tab label="JSON" />
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
                  <DataGrid<JsonPathMatch>
                    ariaLabel="JSONPath matches"
                    rows={result.matches}
                    rowKey={(m) => m.jsonPath}
                    emptyMessage="No values match this expression."
                    columns={[
                      { id: 'path', header: 'Path', getValue: (m) => m.jsonPath, mono: true },
                      {
                        id: 'value',
                        header: 'Value',
                        getValue: (m) => previewValue(m.value),
                        mono: true,
                      },
                    ]}
                  />
                ) : (
                  <CodeEditor
                    value={formatJson(result.matches.map((m) => m.value))}
                    readOnly
                    ariaLabel="JSONPath results"
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
