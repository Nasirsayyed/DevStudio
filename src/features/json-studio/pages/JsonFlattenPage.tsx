import { Alert, Chip, TextField } from '@mui/material';
import { useMemo } from 'react';
import type { ArrayNotation } from '@/core/json/flatten';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { OptionsBar, SelectOption } from '@/components/workspace/OptionControls';
import { TransformLayout } from '../components/TransformLayout';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

export default function JsonFlattenPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<{ delimiter: string; arrayNotation: ArrayNotation }>(
    'json.flatten',
    { delimiter: '.', arrayNotation: 'dot' },
  );
  const payload = useMemo(
    () =>
      input.trim() && opts.delimiter
        ? { text: input, options: { delimiter: opts.delimiter, arrayNotation: opts.arrayNotation } }
        : null,
    [input, opts.delimiter, opts.arrayNotation],
  );
  return (
    <TransformLayout
      toolId="json.flatten"
      op="flatten"
      payload={payload}
      getOutput={(r) => r.text}
      outputFilename="flattened.json"
      sample={SAMPLE_ORDER_JSON}
      historyOptions={opts}
      outputMeta={(r) => (
        <Chip
          size="small"
          variant="outlined"
          label={`${r.keyCount} keys`}
          sx={{ height: 20, fontSize: 11 }}
        />
      )}
      outputWarnings={(r) =>
        r.ambiguousKeys.length > 0 ? (
          <Alert severity="warning" variant="outlined" sx={{ m: 1.5, mb: 0, borderRadius: 2 }}>
            {r.ambiguousKeys.length} key(s) contain the delimiter (
            {r.ambiguousKeys
              .slice(0, 3)
              .map((k) => `"${k}"`)
              .join(', ')}
            {r.ambiguousKeys.length > 3 ? ', …' : ''}), so unflattening won't restore them exactly.
            Choose another delimiter.
          </Alert>
        ) : null
      }
      toolbar={
        <OptionsBar>
          <TextField
            size="small"
            label="Delimiter"
            value={opts.delimiter}
            onChange={(e) => {
              setOpts({ delimiter: e.target.value });
            }}
            error={!opts.delimiter}
            helperText={!opts.delimiter ? 'Required' : undefined}
            sx={{ width: 110 }}
            slotProps={{ htmlInput: { maxLength: 5 } }}
          />
          <SelectOption
            label="Array indexes"
            value={opts.arrayNotation}
            options={[
              { value: 'dot', label: 'items.0.name' },
              { value: 'bracket', label: 'items[0].name' },
            ]}
            onChange={(arrayNotation) => {
              setOpts({ arrayNotation });
            }}
            width={170}
          />
        </OptionsBar>
      }
    />
  );
}
