import { Button, TextField } from '@mui/material';
import { ShieldTick } from 'iconsax-reactjs';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { SchemaDraftOption } from '@/core/json/schemaGenerator';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { TransformLayout } from '../components/TransformLayout';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

export default function JsonSchemaGeneratorPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const setSecondary = useJsonWorkspaceStore((s) => s.setSecondary);
  const navigate = useNavigate();
  const [opts, setOpts] = usePersistentOptions<{
    draft: SchemaDraftOption;
    title: string;
    inferRequired: boolean;
    detectFormats: boolean;
    strictObjects: boolean;
  }>('json.schema-generator', {
    draft: '2020-12',
    title: '',
    inferRequired: true,
    detectFormats: true,
    strictObjects: false,
  });
  const payload = useMemo(
    () =>
      input.trim()
        ? {
            text: input,
            options: {
              draft: opts.draft,
              title: opts.title,
              inferRequired: opts.inferRequired,
              detectFormats: opts.detectFormats,
              strictObjects: opts.strictObjects,
            },
          }
        : null,
    [input, opts.draft, opts.title, opts.inferRequired, opts.detectFormats, opts.strictObjects],
  );
  return (
    <TransformLayout
      toolId="json.schema-generator"
      op="schemaGenerate"
      payload={payload}
      getOutput={(r) => r}
      outputFilename="schema.json"
      outputMime="application/schema+json"
      canReuseOutput={false}
      sample={SAMPLE_ORDER_JSON}
      historyOptions={opts}
      outputMeta={(schema) => (
        <Button
          size="small"
          startIcon={<ShieldTick size={14} color="currentColor" />}
          onClick={() => {
            setSecondary(schema);
            void navigate('/json/schema-validator');
          }}
        >
          Validate with this schema
        </Button>
      )}
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Draft"
            value={opts.draft}
            options={[
              { value: '2020-12', label: '2020-12' },
              { value: '2019-09', label: '2019-09' },
              { value: '7', label: 'Draft 07' },
            ]}
            onChange={(draft) => {
              setOpts({ draft });
            }}
            width={130}
          />
          <TextField
            size="small"
            label="Title (optional)"
            value={opts.title}
            onChange={(e) => {
              setOpts({ title: e.target.value });
            }}
            sx={{ width: 180 }}
          />
          <SwitchOption
            label="Infer required"
            checked={opts.inferRequired}
            onChange={(inferRequired) => {
              setOpts({ inferRequired });
            }}
          />
          <SwitchOption
            label="Detect formats"
            checked={opts.detectFormats}
            onChange={(detectFormats) => {
              setOpts({ detectFormats });
            }}
          />
          <SwitchOption
            label="No additional properties"
            checked={opts.strictObjects}
            onChange={(strictObjects) => {
              setOpts({ strictObjects });
            }}
          />
        </OptionsBar>
      }
    />
  );
}
