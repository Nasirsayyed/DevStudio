/**
 * Self-hosted Monaco setup. Monaco is bundled locally (no CDN loader), so it
 * works offline and under the strict Content Security Policy. Only the
 * languages DevStudio needs are registered.
 */
import { loader } from '@monaco-editor/react';
import * as monaco from './monacoEditorCore';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import { jsonDefaults } from 'monaco-editor/languages/features/json/register.js';
import { type ColorTokens, darkColors, lightColors } from '@/theme/tokens';

interface MonacoEnvironmentScope {
  MonacoEnvironment?: { getWorker: (workerId: string, label: string) => Worker };
}

(self as unknown as MonacoEnvironmentScope).MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    return label === 'json' ? new JsonWorker() : new EditorWorker();
  },
};

// DevStudio's own JSON analyzer is the single source of truth for errors
// (consistent messages and positions), so Monaco's diagnostics are disabled.
jsonDefaults.setDiagnosticsOptions({
  validate: false,
  allowComments: false,
  schemas: [],
  enableSchemaRequest: false,
});

function defineTheme(name: string, base: 'vs' | 'vs-dark', c: ColorTokens) {
  monaco.editor.defineTheme(name, {
    base,
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: base === 'vs' ? '4f46e5' : 'a5b4fc' },
      { token: 'string.value.json', foreground: base === 'vs' ? '15803d' : '86efac' },
      { token: 'number', foreground: base === 'vs' ? 'b45309' : 'fbbf24' },
      { token: 'keyword.json', foreground: base === 'vs' ? 'be185d' : 'f9a8d4' },
    ],
    colors: {
      'editor.background': c.surface,
      'editorGutter.background': c.surface,
      'editor.lineHighlightBackground': base === 'vs' ? '#f3f4f8' : '#171e2e',
      'editorLineNumber.foreground': c.textMuted,
      'editorLineNumber.activeForeground': c.textPrimary,
      'editorWidget.background': c.surfaceRaised,
      'editorWidget.border': c.border,
      'scrollbarSlider.background': `${c.borderStrong}99`,
    },
  });
}

defineTheme('devstudio-light', 'vs', lightColors);
defineTheme('devstudio-dark', 'vs-dark', darkColors);

loader.config({ monaco });

export { monaco };
