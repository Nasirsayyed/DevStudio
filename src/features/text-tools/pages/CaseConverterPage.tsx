import { Box, ListItemText, MenuItem, TextField } from '@mui/material';
import { useMemo } from 'react';
import { OptionsBar } from '@/components/workspace/OptionControls';
import { CASE_STYLES, type CaseStyle } from '@/core/text/case';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';
import { fontFamilies } from '@/theme/tokens';
import { TransformOutput } from '../components/TransformOutput';
import { TextInput } from '../components/TextInput';
import { TextToolLayout } from '../components/TextToolLayout';
import { useTextOperation } from '../hooks';

const SAMPLE = 'user id\nfirstName\nHTTPResponseCode\norder-line-items\nshipping_address_line_2\n';

export default function CaseConverterPage() {
  const [opts, setOpts] = usePersistentOptions<{ style: CaseStyle }>('text.case-converter', {
    style: 'camel',
  });
  const raw = useTextWorkspaceStore((s) => s.text);
  const set = useTextWorkspaceStore((s) => s.set);
  const text = useDebouncedValue(raw, 120);
  const payload = useMemo(() => (text ? { text, style: opts.style } : null), [text, opts.style]);
  const state = useTextOperation('case', payload);
  const style = CASE_STYLES.find((s) => s.id === opts.style);
  return (
    <TextToolLayout
      toolId="text.case-converter"
      toolbar={
        <OptionsBar>
          <TextField
            select
            size="small"
            label="Convert to"
            value={opts.style}
            onChange={(e) => {
              const next = CASE_STYLES.find((s) => s.id === e.target.value);
              if (next) setOpts({ style: next.id });
            }}
            sx={{ width: 260 }}
            slotProps={{ select: { renderValue: () => style?.label ?? '' } }}
          >
            {CASE_STYLES.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                <ListItemText
                  primary={s.label}
                  secondary={s.example}
                  slotProps={{ secondary: { sx: { fontFamily: fontFamilies.mono } } }}
                />
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ color: 'text.secondary', fontSize: 13 }}>
            Identifier styles convert each line separately, so you can convert a list of names at
            once.
          </Box>
        </OptionsBar>
      }
      input={<TextInput field="text" title="Text" sample={SAMPLE} />}
      output={
        <TransformOutput
          toolId="text.case-converter"
          label={`Case: ${style?.label ?? opts.style}`}
          state={state}
          text={state.status === 'success' ? state.result : undefined}
          input={raw}
          historyOptions={opts}
          onUseAsInput={(t) => {
            set({ text: t });
          }}
        />
      }
    />
  );
}
