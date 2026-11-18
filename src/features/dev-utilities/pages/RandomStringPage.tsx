import { Stack, TextField } from '@mui/material';
import { useState } from 'react';
import { SelectOption } from '@/components/workspace/OptionControls';
import { toUserMessage } from '@/core/errors/AppError';
import { entropyStrength } from '@/core/generators/password';
import {
  type CharsetPreset,
  charsetSize,
  generateRandomStrings,
  MAX_RANDOM_COUNT,
  MAX_RANDOM_LENGTH,
} from '@/core/generators/randomString';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { GeneratedList } from '../components/GeneratedList';
import { NumberField } from '../components/NumberField';
import { StrengthMeter } from '../components/StrengthMeter';
import { UtilityPage } from '../components/UtilityPage';

const PRESETS = [
  { value: 'alphanumeric', label: 'Letters + digits (A–Z a–z 0–9)' },
  { value: 'letters', label: 'Letters only' },
  { value: 'lowercase', label: 'Lowercase + digits' },
  { value: 'numeric', label: 'Digits only' },
  { value: 'hex', label: 'Hex (lowercase)' },
  { value: 'HEX', label: 'Hex (uppercase)' },
  { value: 'base64url', label: 'Base64URL alphabet' },
  { value: 'crockford', label: 'Crockford Base32 (no I L O U)' },
  { value: 'custom', label: 'Custom characters…' },
] as const;

interface Options {
  preset: CharsetPreset;
  custom: string;
  length: number;
  count: number;
}

function generate(o: Options): { values: string[]; error: string | null } {
  try {
    return { values: generateRandomStrings(o), error: null };
  } catch (e) {
    return { values: [], error: toUserMessage(e) };
  }
}

export default function RandomStringPage() {
  // Options are remembered; generated values never are (they may be used as secrets).
  const [opts, setOpts] = usePersistentOptions<Options>('utils.random-string', {
    preset: 'alphanumeric',
    custom: 'abc123',
    length: 32,
    count: 5,
  });
  const [result, setResult] = useState(() => generate(opts));
  const update = (patch: Partial<Options>) => {
    setOpts(patch);
    setResult(generate({ ...opts, ...patch }));
  };
  return (
    <UtilityPage toolId="utils.random-string">
      <GeneratedList
        title="Random strings"
        values={result.values}
        error={result.error}
        filename="random-strings.txt"
        onRegenerate={() => {
          setResult(generate(opts));
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <SelectOption
            label="Characters"
            value={opts.preset}
            options={PRESETS}
            onChange={(preset) => {
              update({ preset });
            }}
            width={290}
          />
          {opts.preset === 'custom' && (
            <TextField
              size="small"
              label="Custom characters"
              value={opts.custom}
              onChange={(e) => {
                update({ custom: e.target.value });
              }}
            />
          )}
          <NumberField
            label="Length"
            value={opts.length}
            min={1}
            max={MAX_RANDOM_LENGTH}
            onChange={(length) => {
              update({ length });
            }}
          />
          <NumberField
            label="Count"
            value={opts.count}
            min={1}
            max={MAX_RANDOM_COUNT}
            onChange={(count) => {
              update({ count });
            }}
          />
          <StrengthMeter
            strength={entropyStrength(opts.length, charsetSize(opts.preset, opts.custom))}
          />
        </Stack>
      </GeneratedList>
    </UtilityPage>
  );
}
