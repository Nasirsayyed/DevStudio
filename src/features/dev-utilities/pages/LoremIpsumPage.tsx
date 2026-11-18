import { FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useState } from 'react';
import { SelectOption } from '@/components/workspace/OptionControls';
import { generateLorem, type LoremUnit, MAX_LOREM_COUNT } from '@/core/generators/lorem';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { GeneratedList } from '../components/GeneratedList';
import { NumberField } from '../components/NumberField';
import { UtilityPage } from '../components/UtilityPage';

interface Options {
  unit: LoremUnit;
  count: number;
  startWithLorem: boolean;
}

export default function LoremIpsumPage() {
  const [opts, setOpts] = usePersistentOptions<Options>('utils.lorem-ipsum', {
    unit: 'paragraphs',
    count: 3,
    startWithLorem: true,
  });
  const [text, setText] = useState(() => generateLorem(opts.unit, opts.count, opts.startWithLorem));
  const update = (patch: Partial<Options>) => {
    const next = { ...opts, ...patch };
    setOpts(patch);
    setText(generateLorem(next.unit, next.count, next.startWithLorem));
  };
  const words = text.split(/\s+/).filter(Boolean).length;
  return (
    <UtilityPage toolId="utils.lorem-ipsum">
      <GeneratedList
        title="Placeholder text"
        values={[text]}
        filename="lorem-ipsum.txt"
        onRegenerate={() => {
          setText(generateLorem(opts.unit, opts.count, opts.startWithLorem));
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <NumberField
            label="Count"
            value={opts.count}
            min={1}
            max={MAX_LOREM_COUNT}
            onChange={(count) => {
              update({ count });
            }}
          />
          <SelectOption
            label="Unit"
            value={opts.unit}
            options={[
              { value: 'paragraphs', label: 'Paragraphs' },
              { value: 'sentences', label: 'Sentences' },
              { value: 'words', label: 'Words' },
            ]}
            onChange={(unit) => {
              update({ unit });
            }}
            width={150}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={opts.startWithLorem}
                onChange={(e) => {
                  update({ startWithLorem: e.target.checked });
                }}
              />
            }
            label='Start with "Lorem ipsum…"'
          />
          <Typography variant="caption" color="text.secondary">
            {words} words · {text.length} characters
          </Typography>
        </Stack>
      </GeneratedList>
    </UtilityPage>
  );
}
