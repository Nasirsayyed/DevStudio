import type { CodeEditorProps, DiffEditorProps } from '@/components/code-editor/types';

/**
 * jsdom cannot run Monaco. Component tests use this accessible textarea with
 * the same props contract; real Monaco is covered by Playwright.
 */
export default function MockCodeEditor({
  value,
  onChange,
  readOnly,
  ariaLabel,
  markers,
  onRun,
  reveal,
}: CodeEditorProps) {
  return (
    <div data-testid="code-editor" data-reveal-line={reveal?.line}>
      <textarea
        aria-label={ariaLabel}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onRun?.();
        }}
      />
      {markers && markers.length > 0 && (
        <ul aria-label={`${ariaLabel} problems`}>
          {markers.map((m) => (
            <li
              key={`${m.line}:${m.column}:${m.message}`}
            >{`${m.severity} ${m.line}:${m.column} ${m.message}`}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MockDiffEditor({ original, modified, ariaLabel }: DiffEditorProps) {
  return (
    <div role="region" aria-label={ariaLabel} data-testid="diff-editor">
      <pre data-testid="diff-original">{original}</pre>
      <pre data-testid="diff-modified">{modified}</pre>
    </div>
  );
}
