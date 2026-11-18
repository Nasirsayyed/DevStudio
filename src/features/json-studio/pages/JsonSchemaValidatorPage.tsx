import { Alert, Box, Chip } from '@mui/material';
import { useMemo } from 'react';
import { Panel } from '@/components';
import { DataGrid } from '@/components/data-display/DataGrid';
import { parseJsonPointer, toJsonPath } from '@/core/json/path';
import { SAMPLE_ORDER_JSON, SAMPLE_SCHEMA_JSON } from '@/core/json/samples';
import type { SchemaValidationIssue, ValidatorDraft } from '@/core/json/schemaValidator';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { DualInputLayout } from '../components/DualInputLayout';
import { JsonInputPanel } from '@/components/workspace/JsonInputPanel';
import { OptionsBar, SelectOption } from '@/components/workspace/OptionControls';
import { OperationStatusView } from '@/components/workspace/OperationStatusView';
import { parseErrorFor, useJsonOperation } from '../hooks/useJsonOperation';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

const DRAFTS = [
  { value: 'auto', label: 'Auto ($schema)' },
  { value: '2020-12', label: '2020-12' },
  { value: '2019-09', label: '2019-09' },
  { value: '7', label: 'Draft 07' },
  { value: '4', label: 'Draft 04' },
] as const;

function locationLabel(pointer: string): string {
  try {
    return toJsonPath(parseJsonPointer(pointer));
  } catch {
    return pointer || '$';
  }
}

export default function JsonSchemaValidatorPage() {
  const data = useJsonWorkspaceStore((s) => s.input);
  const schema = useJsonWorkspaceStore((s) => s.secondary);
  const setData = useJsonWorkspaceStore((s) => s.setInput);
  const setSchema = useJsonWorkspaceStore((s) => s.setSecondary);
  const [opts, setOpts] = usePersistentOptions<{ draft: ValidatorDraft }>('json.schema-validator', {
    draft: 'auto',
  });
  const payload = useMemo(
    () => (data.trim() && schema.trim() ? { data, schema, draft: opts.draft } : null),
    [data, schema, opts.draft],
  );
  const state = useJsonOperation('schemaValidate', payload);

  return (
    <DualInputLayout
      toolId="json.schema-validator"
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Schema draft"
            value={opts.draft}
            options={DRAFTS}
            onChange={(draft) => {
              setOpts({ draft });
            }}
            width={170}
          />
        </OptionsBar>
      }
      first={
        <JsonInputPanel
          title="Data"
          value={data}
          onChange={setData}
          documents
          sample={SAMPLE_ORDER_JSON}
          error={parseErrorFor(state.error, 'data')}
          onRun={state.run}
        />
      }
      second={
        <JsonInputPanel
          title="JSON Schema"
          value={schema}
          onChange={setSchema}
          sample={SAMPLE_SCHEMA_JSON}
          error={parseErrorFor(state.error, 'schema')}
          onRun={state.run}
        />
      }
      results={
        <Panel
          title="Validation"
          busy={state.status === 'running'}
          meta={
            state.result ? (
              <Chip
                size="small"
                variant="outlined"
                label={`Draft ${state.result.draft}`}
                sx={{ height: 20, fontSize: 11 }}
              />
            ) : undefined
          }
        >
          <OperationStatusView
            state={state}
            emptyHint="Provide data and a JSON Schema above. Remote $ref URLs are never fetched."
          >
            {(result) =>
              result.valid ? (
                <Alert severity="success" role="status" sx={{ m: 1.5, borderRadius: 2 }}>
                  The data is valid against the schema.
                </Alert>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    minHeight: 0,
                    p: 1,
                    gap: 1,
                  }}
                >
                  <Alert severity="error" role="alert" sx={{ borderRadius: 2 }}>
                    {result.errors.length} validation error{result.errors.length === 1 ? '' : 's'}
                  </Alert>
                  <DataGrid<SchemaValidationIssue>
                    ariaLabel="Schema validation errors"
                    rows={result.errors}
                    rowKey={(e, i) => `${e.instanceLocation}:${e.keywordLocation}:${i}`}
                    columns={[
                      {
                        id: 'location',
                        header: 'Location',
                        getValue: (e) => locationLabel(e.instanceLocation),
                        mono: true,
                      },
                      {
                        id: 'keyword',
                        header: 'Keyword',
                        width: 140,
                        getValue: (e) => e.keyword,
                        mono: true,
                      },
                      { id: 'message', header: 'Message', getValue: (e) => e.message },
                    ]}
                  />
                </Box>
              )
            }
          </OperationStatusView>
        </Panel>
      }
    />
  );
}
