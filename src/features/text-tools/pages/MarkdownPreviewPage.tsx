import { Box, Chip, Tab, Tabs, useTheme } from '@mui/material';
import { useMemo, useState } from 'react';
import { CodeEditor, CopyButton, Panel } from '@/components';
import { DownloadButton } from '@/components/inputs/DownloadButton';
import { OperationStatusView } from '@/components/workspace/OperationStatusView';
import { OptionsBar, SwitchOption } from '@/components/workspace/OptionControls';
import { MARKDOWN_FILE_RULES } from '@/core/files/fileValidation';
import { formatDuration, READING_WPM } from '@/core/text/stats';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { previewDocument, sanitizeHtml } from '@/services/html/sanitize';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';
import { PreviewFrame } from '../components/PreviewFrame';
import { previewCss } from '../components/previewCss';
import { SanitizerNotice } from '../components/SanitizerNotice';
import { TextInput } from '../components/TextInput';
import { TextToolLayout } from '../components/TextToolLayout';
import { useTextOperation } from '../hooks';
import { SAMPLE_MARKDOWN } from '../samples';

export default function MarkdownPreviewPage() {
  const [opts, setOpts] = usePersistentOptions<{ gfm: boolean; breaks: boolean }>(
    'text.markdown-preview',
    {
      gfm: true,
      breaks: false,
    },
  );
  const [tab, setTab] = useState(0);
  const theme = useTheme();
  const raw = useTextWorkspaceStore((s) => s.markdown);
  const text = useDebouncedValue(raw, 200);
  const record = useHistoryRecorder('text.markdown-preview');
  const payload = useMemo(() => (text ? { text, options: opts } : null), [text, opts]);
  const state = useTextOperation('markdown', payload);
  const rendered = state.status === 'success' ? state.result : undefined;
  // The worker only renders; sanitizing needs the DOM, so it runs here.
  const report = useMemo(() => (rendered ? sanitizeHtml(rendered.html) : null), [rendered]);
  const css = previewCss(theme.palette.mode, true);
  const doc = report ? previewDocument(report.html, { css }) : '';
  const standalone = report
    ? `<!doctype html>\n<html><head><meta charset="utf-8"><title>Document</title><style>${previewCss('light', true)}</style></head><body>\n${report.html}\n</body></html>\n`
    : '';

  return (
    <TextToolLayout
      toolId="text.markdown-preview"
      toolbar={
        <OptionsBar>
          <SwitchOption
            label="GitHub-flavoured (tables, task lists)"
            checked={opts.gfm}
            onChange={(gfm) => {
              setOpts({ gfm });
            }}
          />
          <SwitchOption
            label="Line breaks as <br>"
            checked={opts.breaks}
            onChange={(breaks) => {
              setOpts({ breaks });
            }}
          />
        </OptionsBar>
      }
      input={
        <TextInput
          field="markdown"
          title="Markdown"
          language="markdown"
          rules={MARKDOWN_FILE_RULES}
          sample={SAMPLE_MARKDOWN}
        />
      }
      output={
        <Panel
          title="Preview"
          busy={state.status === 'running'}
          meta={
            rendered ? (
              <Chip
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 11 }}
                label={`${rendered.words.toLocaleString()} words · ${formatDuration(Math.ceil((rendered.words / READING_WPM) * 60))} read`}
              />
            ) : undefined
          }
          actions={
            report ? (
              <>
                <CopyButton
                  label="Copy HTML"
                  value={report.html}
                  onCopied={() => {
                    record('Markdown → HTML', raw, report.html, opts);
                  }}
                />
                <DownloadButton
                  content={standalone}
                  filename="document.html"
                  mimeType="text/html"
                  label="Download HTML"
                  onDownloaded={() => {
                    record('Markdown → HTML (download)', raw, report.html, opts);
                  }}
                />
              </>
            ) : undefined
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
            <Tab label="HTML" sx={{ minHeight: 40 }} />
          </Tabs>
          <OperationStatusView state={state} emptyHint="Write or open Markdown on the left.">
            {() =>
              report ? (
                <>
                  <SanitizerNotice report={report} />
                  {tab === 0 ? (
                    <PreviewFrame doc={doc} title="Markdown preview" />
                  ) : (
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      <CodeEditor
                        value={report.html}
                        readOnly
                        language="html"
                        ariaLabel="Generated HTML"
                        wordWrap
                      />
                    </Box>
                  )}
                </>
              ) : null
            }
          </OperationStatusView>
        </Panel>
      }
    />
  );
}
