import { Box, useTheme } from '@mui/material';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { fontFamilies } from '@/theme/tokens';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { monaco } from './monacoSetup';
import { type CodeEditorProps, LARGE_FILE_CHARS } from './types';

type StandaloneEditor = Parameters<OnMount>[0];

const SEVERITY = {
  error: monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info: monaco.MarkerSeverity.Info,
} as const;

export default function MonacoCodeEditor({
  value,
  onChange,
  language = 'json',
  readOnly = false,
  markers,
  reveal,
  ariaLabel,
  onRun,
  wordWrap,
  height = '100%',
}: CodeEditorProps) {
  const theme = useTheme();
  const prefs = usePreferencesStore((s) => s.editor);
  const editorRef = useRef<StandaloneEditor | null>(null);
  const onRunRef = useRef(onRun);
  useEffect(() => {
    onRunRef.current = onRun;
  });

  const large = value.length > LARGE_FILE_CHARS;

  /*
   * The editor owns its text while the user types. Values it emitted itself are remembered until
   * the parent echoes them back, so a late or stale echo (e.g. from a form library that updates on
   * the next render) can never overwrite newer keystrokes. Any other value is an external change
   * (load, reset, "use output as input") and replaces the content.
   */
  const emitted = useRef<string[]>([]);
  const latestValue = useRef(value);
  useEffect(() => {
    latestValue.current = value;
    const editor = editorRef.current;
    if (!editor) return;
    const echo = emitted.current.lastIndexOf(value);
    if (echo >= 0) {
      emitted.current = emitted.current.slice(echo + 1);
      return;
    }
    emitted.current = [];
    if (editor.getValue() === value) return;
    if (readOnly) {
      editor.setValue(value);
      return;
    }
    const model = editor.getModel();
    if (!model) return;
    // An edit (not setValue) keeps the change undoable with Ctrl/⌘+Z.
    editor.pushUndoStop();
    editor.executeEdits('devstudio', [{ range: model.getFullModelRange(), text: value }]);
    editor.pushUndoStop();
  }, [value, readOnly]);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    if (editor.getValue() !== latestValue.current) editor.setValue(latestValue.current);
    editor.addAction({
      id: 'devstudio.run',
      label: 'Run tool',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => onRunRef.current?.(),
    });
  };

  // Error/warning markers.
  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model,
      'devstudio',
      (markers ?? []).map((m) => ({
        startLineNumber: m.line,
        startColumn: m.column,
        endLineNumber: m.endLine ?? m.line,
        endColumn: m.endColumn ?? m.column + 1,
        message: m.message,
        severity: SEVERITY[m.severity],
      })),
    );
  }, [markers, value]);

  // Jump to a position (e.g. "Go to error").
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !reveal) return;
    const position = { lineNumber: reveal.line, column: reveal.column ?? 1 };
    editor.revealPositionInCenter(position);
    editor.setPosition(position);
    editor.focus();
  }, [reveal]);

  return (
    <Box sx={{ height, minHeight: 0, width: '100%', overflow: 'hidden' }} data-testid="code-editor">
      <Editor
        defaultValue={value}
        language={language}
        theme={theme.palette.mode === 'dark' ? 'devstudio-dark' : 'devstudio-light'}
        onMount={handleMount}
        onChange={(v) => {
          if (!onChange) return;
          const text = v ?? '';
          emitted.current.push(text);
          if (emitted.current.length > 100) emitted.current.shift();
          onChange(text);
        }}
        loading={null}
        options={{
          readOnly,
          ariaLabel,
          fontFamily: fontFamilies.mono,
          fontSize: prefs.fontSize,
          tabSize: prefs.tabSize,
          wordWrap: (wordWrap ?? prefs.wordWrap) && !large ? 'on' : 'off',
          minimap: { enabled: prefs.minimap && !large },
          folding: !large,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          renderValidationDecorations: 'on',
          fixedOverflowWidgets: true,
          padding: { top: 8, bottom: 8 },
          stickyScroll: { enabled: !large },
          bracketPairColorization: { enabled: !large },
          domReadOnly: readOnly,
          contextmenu: true,
        }}
      />
    </Box>
  );
}
