import { TextField } from '@mui/material';
import { useMemo } from 'react';
import { SAMPLE_FLAT_JSON } from '@/core/json/samples';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { OptionsBar, SwitchOption } from '../components/OptionControls';
import { TransformLayout } from '../components/TransformLayout';
import { useJsonStudioStore } from '../store';

export default function JsonUnflattenPage() {
  const input = useJsonStudioStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions('json.unflatten', {
    delimiter: '.',
    detectArrays: true,
  });
  const payload = useMemo(
    () =>
      input.trim() && opts.delimiter
        ? { text: input, options: { delimiter: opts.delimiter, detectArrays: opts.detectArrays } }
        : null,
    [input, opts.delimiter, opts.detectArrays],
  );
  return (
    <TransformLayout
      toolId="json.unflatten"
      op="unflatten"
      payload={payload}
      getOutput={(r) => r}
      outputFilename="unflattened.json"
      sample={SAMPLE_FLAT_JSON}
      historyOptions={opts}
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
            sx={{ width: 110 }}
            slotProps={{ htmlInput: { maxLength: 5 } }}
          />
          <SwitchOption
            label="Turn 0..n keys into arrays"
            checked={opts.detectArrays}
            onChange={(detectArrays) => {
              setOpts({ detectArrays });
            }}
          />
        </OptionsBar>
      }
    />
  );
}
