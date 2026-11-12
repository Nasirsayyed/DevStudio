import { Autocomplete, TextField } from '@mui/material';
import { DiffEditor, EmptyState, Panel } from '@/components';
import { CODE_LANGUAGES, languageForFile } from '@/core/languages/languages';
import { OptionsBar, SwitchOption } from '@/components/workspace/OptionControls';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';
import { TextInput } from '../components/TextInput';
import { CompareLayout } from '../components/TextToolLayout';
import { SAMPLE_CODE_LEFT, SAMPLE_CODE_RIGHT } from '../samples';

interface Options {
  language: string;
  sideBySide: boolean;
  ignoreTrimWhitespace: boolean;
  wordWrap: boolean;
}

export default function CodeDiffPage() {
  const [opts, setOpts] = usePersistentOptions<Options>('text.code-diff', {
    language: 'typescript',
    sideBySide: true,
    ignoreTrimWhitespace: true,
    wordWrap: false,
  });
  const left = useTextWorkspaceStore((s) => s.codeLeft);
  const right = useTextWorkspaceStore((s) => s.codeRight);
  const original = useDebouncedValue(left, 250);
  const modified = useDebouncedValue(right, 250);
  const language = CODE_LANGUAGES.find((l) => l.id === opts.language) ?? CODE_LANGUAGES[0];
  const pickLanguage = (fileName: string) => {
    const detected = languageForFile(fileName);
    if (detected) setOpts({ language: detected });
  };

  return (
    <CompareLayout
      toolId="text.code-diff"
      toolbar={
        <OptionsBar>
          <Autocomplete
            size="small"
            disableClearable
            options={CODE_LANGUAGES}
            value={language}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, v) => {
              setOpts({ language: v.id });
            }}
            renderInput={(params) => <TextField {...params} label="Language" />}
            sx={{ width: 200 }}
          />
          <SwitchOption
            label="Side by side"
            checked={opts.sideBySide}
            onChange={(sideBySide) => {
              setOpts({ sideBySide });
            }}
          />
          <SwitchOption
            label="Ignore leading/trailing whitespace"
            checked={opts.ignoreTrimWhitespace}
            onChange={(ignoreTrimWhitespace) => {
              setOpts({ ignoreTrimWhitespace });
            }}
          />
          <SwitchOption
            label="Wrap lines"
            checked={opts.wordWrap}
            onChange={(wordWrap) => {
              setOpts({ wordWrap });
            }}
          />
        </OptionsBar>
      }
      left={
        <TextInput
          field="codeLeft"
          title="Original code"
          language={opts.language}
          sample={SAMPLE_CODE_LEFT}
          onFileLoaded={pickLanguage}
        />
      }
      right={
        <TextInput
          field="codeRight"
          title="Modified code"
          language={opts.language}
          sample={SAMPLE_CODE_RIGHT}
          onFileLoaded={pickLanguage}
        />
      }
      result={
        <Panel title="Differences" ariaLabel="Comparison">
          {original || modified ? (
            <DiffEditor
              original={original}
              modified={modified}
              language={opts.language}
              sideBySide={opts.sideBySide}
              ignoreTrimWhitespace={opts.ignoreTrimWhitespace}
              wordWrap={opts.wordWrap}
              ariaLabel="Code differences"
            />
          ) : (
            <EmptyState
              dense
              title="Nothing to compare yet"
              description="Paste, type or open code in both editors above."
            />
          )}
        </Panel>
      }
    />
  );
}
