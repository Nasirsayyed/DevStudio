import { Box, useTheme } from '@mui/material';
import { DiffEditor as MonacoDiff } from '@monaco-editor/react';
import { fontFamilies } from '@/theme/tokens';
import { usePreferencesStore } from '@/stores/preferencesStore';
import './monacoSetup';
import type { DiffEditorProps } from './types';

export default function MonacoDiffEditor({
  original,
  modified,
  language = 'json',
  sideBySide = true,
  ariaLabel,
  height = '100%',
}: DiffEditorProps) {
  const theme = useTheme();
  const prefs = usePreferencesStore((s) => s.editor);
  return (
    <Box
      sx={{ height, minHeight: 0, width: '100%' }}
      data-testid="diff-editor"
      aria-label={ariaLabel}
      role="region"
    >
      <MonacoDiff
        original={original}
        modified={modified}
        language={language}
        theme={theme.palette.mode === 'dark' ? 'devstudio-dark' : 'devstudio-light'}
        loading={null}
        options={{
          readOnly: true,
          originalEditable: false,
          renderSideBySide: sideBySide,
          fontFamily: fontFamilies.mono,
          fontSize: prefs.fontSize,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          minimap: { enabled: false },
          ariaLabel,
        }}
      />
    </Box>
  );
}
