import { useState } from 'react';
import { SelectOption } from '@/components/workspace/OptionControls';
import { decodeHtmlEntities, encodeHtmlEntities, type HtmlEncodeMode } from '@/core/encoding/html';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { TextTransformCard } from '../components/TextTransformCard';
import { UtilityPage } from '../components/UtilityPage';
import { useTextTransform } from '../hooks';

type Mode = 'encode' | 'decode';

export default function HtmlEntitiesPage() {
  const [opts, setOpts] = usePersistentOptions<{ mode: Mode; encodeMode: HtmlEncodeMode }>(
    'utils.html-entities',
    { mode: 'encode', encodeMode: 'minimal' },
  );
  const [input, setInput] = useState('');
  const record = useHistoryRecorder('utils.html-entities');
  const result = useTextTransform(input, (t) =>
    opts.mode === 'encode' ? encodeHtmlEntities(t, opts.encodeMode) : decodeHtmlEntities(t),
  );
  return (
    <UtilityPage toolId="utils.html-entities">
      <TextTransformCard
        modes={[
          { value: 'encode', label: 'Encode' },
          { value: 'decode', label: 'Decode' },
        ]}
        mode={opts.mode}
        onModeChange={(mode) => {
          setOpts({ mode });
        }}
        input={input}
        onInputChange={setInput}
        inputLabel={
          opts.mode === 'encode'
            ? 'Text or HTML to escape'
            : 'Text with entities (&lt; &#169; &#x1F600; …)'
        }
        inputPlaceholder={
          opts.mode === 'encode' ? '<p>Café & "friends"</p>' : '&lt;p&gt;Caf&eacute;&lt;/p&gt;'
        }
        result={result}
        outputLabel={opts.mode === 'encode' ? 'Escaped' : 'Decoded'}
        onCopied={() => {
          record(`HTML entities ${opts.mode}`, input, result.text ?? '', opts);
        }}
        options={
          opts.mode === 'encode' ? (
            <SelectOption
              label="Escape"
              value={opts.encodeMode}
              options={[
                { value: 'minimal', label: 'Only & < > " \' (safe default)' },
                { value: 'non-ascii', label: 'Also non-ASCII (named)' },
                { value: 'numeric', label: 'Also non-ASCII (&#x…;)' },
                { value: 'all-named', label: 'Everything with a name' },
              ]}
              onChange={(encodeMode) => {
                setOpts({ encodeMode });
              }}
              width={280}
            />
          ) : undefined
        }
      />
    </UtilityPage>
  );
}
