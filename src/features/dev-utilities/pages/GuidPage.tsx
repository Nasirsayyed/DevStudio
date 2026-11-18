import { FormControlLabel, Stack, Switch } from '@mui/material';
import { useState } from 'react';
import { SelectOption } from '@/components/workspace/OptionControls';
import { formatGuid, generateUuids, type GuidFormat, MAX_UUID_COUNT } from '@/core/generators/uuid';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { GeneratedList } from '../components/GeneratedList';
import { NumberField } from '../components/NumberField';
import { UtilityPage } from '../components/UtilityPage';

const FORMATS = [
  { value: 'D', label: 'D — 00000000-0000-0000-0000-000000000000' },
  { value: 'N', label: 'N — 00000000000000000000000000000000' },
  { value: 'B', label: 'B — {00000000-0000-0000-0000-000000000000}' },
  { value: 'P', label: 'P — (00000000-0000-0000-0000-000000000000)' },
  { value: 'X', label: 'X — {0x00000000,0x0000,0x0000,{0x00,…}}' },
] as const;

interface Options {
  format: GuidFormat;
  count: number;
  uppercase: boolean;
}

const generate = (o: Options) =>
  generateUuids('v4', o.count).map((u) => formatGuid(u, o.format, o.uppercase));

export default function GuidPage() {
  const [opts, setOpts] = usePersistentOptions<Options>('utils.guid', {
    format: 'D',
    count: 5,
    uppercase: true,
  });
  const [values, setValues] = useState(() => generate(opts));
  const update = (patch: Partial<Options>) => {
    setOpts(patch);
    setValues(generate({ ...opts, ...patch }));
  };
  return (
    <UtilityPage toolId="utils.guid">
      <GeneratedList
        title="GUIDs"
        values={values}
        filename="guids.txt"
        onRegenerate={() => {
          setValues(generate(opts));
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <SelectOption
            label=".NET format"
            value={opts.format}
            options={FORMATS}
            onChange={(format) => {
              update({ format });
            }}
            width={420}
          />
          <NumberField
            label="Count"
            value={opts.count}
            min={1}
            max={MAX_UUID_COUNT}
            onChange={(count) => {
              update({ count });
            }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={opts.uppercase}
                onChange={(e) => {
                  update({ uppercase: e.target.checked });
                }}
              />
            }
            label="Uppercase"
          />
        </Stack>
      </GeneratedList>
    </UtilityPage>
  );
}
