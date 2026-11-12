import { Box, Tab, Tabs, useTheme } from '@mui/material';
import { useMemo, useState } from 'react';
import { CodeEditor, CopyButton, EmptyState, Panel } from '@/components';
import { OptionsBar, SelectOption } from '@/components/workspace/OptionControls';
import { HTML_FILE_RULES } from '@/core/files/fileValidation';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { previewDocument, sanitizeHtml } from '@/services/html/sanitize';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';
import { PreviewFrame } from '../components/PreviewFrame';
import { previewCss } from '../components/previewCss';
import { SanitizerNotice } from '../components/SanitizerNotice';
import { TextInput } from '../components/TextInput';
import { TextToolLayout } from '../components/TextToolLayout';
import { SAMPLE_HTML } from '../samples';

const WIDTHS = [
  { value: 0, label: 'Fit panel' },
  { value: 1280, label: 'Desktop (1280)' },
  { value: 768, label: 'Tablet (768)' },
  { value: 390, label: 'Phone (390)' },
] as const;

export default function HtmlPreviewPage() {
  const [opts, setOpts] = usePersistentOptions<{ width: number }>('text.html-preview', {
    width: 0,
  });
  const [tab, setTab] = useState(0);
  const theme = useTheme();
  const raw = useTextWorkspaceStore((s) => s.html);
  const html = useDebouncedValue(raw, 300);
  const wholeDocument = /<(html|head|body)[\s>]/i.test(html);
  const report = useMemo(
    () => (html.trim() ? sanitizeHtml(html, { wholeDocument }) : null),
    [html, wholeDocument],
  );
  const doc = report
    ? previewDocument(report.html, { css: previewCss(theme.palette.mode, false), wholeDocument })
    : '';

  return (
    <TextToolLayout
      toolId="text.html-preview"
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Viewport"
            value={opts.width}
            options={WIDTHS}
            width={170}
            onChange={(width) => {
              setOpts({ width });
            }}
          />
          <Box sx={{ color: 'text.secondary', fontSize: 13 }}>
            Scripts, event handlers, forms and frames are removed and external resources are
            blocked. The preview runs in a sandboxed frame.
          </Box>
        </OptionsBar>
      }
      input={
        <TextInput
          field="html"
          title="HTML"
          language="html"
          rules={HTML_FILE_RULES}
          sample={SAMPLE_HTML}
        />
      }
      output={
        <Panel
          title="Preview"
          actions={
            report ? <CopyButton label="Copy sanitized HTML" value={report.html} /> : undefined
          }
        >
          <Tabs
            value={tab}
            onChange={(_, v: number) => {
              setTab(v);
            }}
            sx={{ px: 1.5, minHeight: 40, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Preview" sx={{ minHeight: 40 }} />
            <Tab label="Sanitized HTML" sx={{ minHeight: 40 }} />
          </Tabs>
          {!report ? (
            <EmptyState
              dense
              title="Nothing to preview"
              description="Paste, type or open HTML on the left."
            />
          ) : (
            <>
              <SanitizerNotice report={report} />
              {tab === 0 ? (
                <PreviewFrame doc={doc} title="HTML preview" width={opts.width || '100%'} />
              ) : (
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <CodeEditor
                    value={report.html}
                    readOnly
                    language="html"
                    ariaLabel="Sanitized HTML"
                    wordWrap
                  />
                </Box>
              )}
            </>
          )}
        </Panel>
      }
    />
  );
}
