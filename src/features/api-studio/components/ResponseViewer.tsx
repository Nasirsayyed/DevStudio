import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CodeEditor, CopyButton, EmptyState, LoadingState, Panel, useNotify } from '@/components';
import { JsonViewer } from '@/components/data-display/JsonViewer';
import { DownloadButton } from '@/components/inputs/DownloadButton';
import { PreviewFrame } from '@/components/preview/PreviewFrame';
import { previewCss } from '@/components/preview/previewCss';
import { formatBytes } from '@/core/format/bytes';
import type { PreparedRequest } from '@/core/http/build';
import type { JsonValue } from '@/core/json/types';
import { tryParseJson } from '@/core/security/safeJsonParse';
import { useTaskOperation } from '@/hooks/useTaskOperation';
import { previewDocument, sanitizeHtml } from '@/services/html/sanitize';
import type { HttpResponseSnapshot } from '@/services/http/executor';
import { downloadBytes } from '@/services/files/textFiles';
import { jsonTasks } from '@/services/workers/jsonTasks';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { fontFamilies } from '@/theme/tokens';
import type { SendState } from '../hooks';

type View = 'pretty' | 'raw' | 'tree' | 'preview';

function statusColor(status: number): 'success' | 'info' | 'warning' | 'error' | 'default' {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'error';
  return 'default';
}

function extension(contentType: string): string {
  const t = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (t.includes('json')) return 'json';
  if (t.includes('xml')) return 'xml';
  if (t.includes('html')) return 'html';
  if (t.startsWith('text/')) return 'txt';
  if (t.startsWith('image/')) return t.slice(6).replace('svg+xml', 'svg').replace('jpeg', 'jpg');
  if (t === 'application/pdf') return 'pdf';
  return 'bin';
}

function languageOf(contentType: string, text: string): string {
  const t = contentType.toLowerCase();
  if (t.includes('json') || /^\s*[[{]/.test(text)) return 'json';
  if (t.includes('html')) return 'html';
  if (t.includes('xml') || /^\s*</.test(text)) return 'xml';
  if (t.includes('javascript')) return 'javascript';
  if (t.includes('css')) return 'css';
  return 'plaintext';
}

function ImagePreview({ bytes, type }: { bytes: Uint8Array<ArrayBuffer>; type: string }) {
  const url = useMemo(() => URL.createObjectURL(new Blob([bytes], { type })), [bytes, type]);
  useEffect(
    () => () => {
      URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
      <Box
        component="img"
        src={url}
        alt="Response image"
        sx={{
          maxWidth: '100%',
          backgroundImage: 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%)',
          backgroundSize: '16px 16px',
        }}
      />
    </Box>
  );
}

function KvTable({ label, rows }: { label: string; rows: readonly [string, string][] }) {
  return (
    <Table size="small" aria-label={label}>
      <TableBody>
        {rows.map(([k, v], i) => (
          <TableRow key={`${k}-${String(i)}`}>
            <TableCell
              component="th"
              scope="row"
              sx={{
                fontFamily: fontFamilies.mono,
                fontWeight: 600,
                width: '35%',
                verticalAlign: 'top',
              }}
            >
              {k}
            </TableCell>
            <TableCell sx={{ fontFamily: fontFamilies.mono, overflowWrap: 'anywhere' }}>
              {v}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SentRequest({ p }: { p: PreparedRequest }) {
  return (
    <Stack spacing={1.5} sx={{ p: 2, overflow: 'auto' }}>
      <Typography
        sx={{ fontFamily: fontFamilies.mono, overflowWrap: 'anywhere' }}
        aria-label="Sent request line"
      >
        <strong>{p.method}</strong> {p.url}
      </Typography>
      {p.headers.length > 0 ? (
        <KvTable label="Sent headers" rows={p.headers} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          No headers set by you (the browser adds its own).
        </Typography>
      )}
      {p.body.kind === 'text' && (
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            bgcolor: 'background.sunken',
            borderRadius: 1.5,
            fontFamily: fontFamilies.mono,
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            maxHeight: 300,
            overflow: 'auto',
          }}
        >
          {p.body.text.length > 20_000 ? `${p.body.text.slice(0, 20_000)}…` : p.body.text}
        </Box>
      )}
      {p.body.kind === 'form-data' && (
        <KvTable
          label="Sent form fields"
          rows={p.body.fields.map((f) => [f.key, f.fileEntryId ? `📎 ${f.value}` : f.value])}
        />
      )}
    </Stack>
  );
}

function ResponseBody({ r }: { r: HttpResponseSnapshot }) {
  const theme = useTheme();
  const notify = useNotify();
  const navigate = useNavigate();
  const loadDocument = useJsonWorkspaceStore((s) => s.loadDocument);
  const text = r.text ?? '';
  const isJson = r.text !== null && languageOf(r.contentType, text) === 'json';
  const isHtml = r.contentType.toLowerCase().includes('html');
  const isImage =
    r.text === null && r.contentType.toLowerCase().startsWith('image/') && !r.truncated;
  const [view, setView] = useState<View>(isHtml || isImage ? 'preview' : 'pretty');
  const pretty = useTaskOperation<{ text: string; indent: 2 }, string>(
    'api.response.format',
    (p, o) => jsonTasks.run('format', p, o),
    useMemo(
      () => (isJson && view === 'pretty' ? { text, indent: 2 as const } : null),
      [isJson, view, text],
    ),
  );
  const tree = useMemo((): JsonValue | null => {
    if (!isJson || view !== 'tree') return null;
    const parsed = tryParseJson(text);
    return parsed.ok ? (parsed.value as JsonValue) : null;
  }, [isJson, view, text]);
  const html = useMemo(
    () =>
      isHtml && view === 'preview'
        ? previewDocument(
            sanitizeHtml(text, { wholeDocument: /<(html|body)[\s>]/i.test(text) }).html,
            {
              css: previewCss(theme.palette.mode, false),
              wholeDocument: /<(html|body)[\s>]/i.test(text),
            },
          )
        : '',
    [isHtml, view, text, theme.palette.mode],
  );

  const views: { value: View; label: string; show: boolean }[] = [
    { value: 'pretty', label: 'Pretty', show: r.text !== null },
    { value: 'raw', label: 'Raw', show: r.text !== null },
    { value: 'tree', label: 'Tree', show: isJson },
    { value: 'preview', label: 'Preview', show: isHtml || isImage },
  ];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ alignItems: 'center', px: 1.5, py: 0.75, flexWrap: 'wrap' }}
      >
        {views.some((v) => v.show) && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            aria-label="Body view"
            onChange={(_, v: View | null) => {
              if (v) setView(v);
            }}
          >
            {views
              .filter((v) => v.show)
              .map((v) => (
                <ToggleButton
                  key={v.value}
                  value={v.value}
                  sx={{ py: 0.25, px: 1.25, textTransform: 'none' }}
                >
                  {v.label}
                </ToggleButton>
              ))}
          </ToggleButtonGroup>
        )}
        <Box sx={{ flex: 1 }} />
        {r.text !== null && <CopyButton label="Copy response body" value={text} />}
        <DownloadButton
          content={() => text}
          filename={`response.${extension(r.contentType)}`}
          mimeType={r.contentType || 'application/octet-stream'}
          label="Download response body"
          disabled={r.text === null}
        />
        {r.text === null && (
          <Button
            size="small"
            onClick={() => {
              downloadBytes(
                r.bytes,
                `response.${extension(r.contentType)}`,
                r.contentType || 'application/octet-stream',
              );
            }}
          >
            Download file
          </Button>
        )}
        {isJson && (
          <Button
            size="small"
            onClick={() => {
              loadDocument(text, null);
              notify.info('Opened the response in JSON Studio.');
              void navigate('/json/formatter');
            }}
          >
            Open in JSON Studio
          </Button>
        )}
      </Stack>
      {r.truncated && (
        <Alert severity="warning" sx={{ mx: 1.5, mb: 1, py: 0 }}>
          The response was larger than {formatBytes(r.sizeBytes)} and was cut off.
        </Alert>
      )}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {r.sizeBytes === 0 ? (
          <EmptyState dense title="Empty body" description="The response has no content." />
        ) : r.text === null && !isImage ? (
          <EmptyState
            dense
            title={`Binary content (${formatBytes(r.sizeBytes)})`}
            description={`${r.contentType || 'Unknown type'}. Use "Download file" to save it.`}
          />
        ) : view === 'preview' && isImage ? (
          <ImagePreview bytes={r.bytes} type={r.contentType} />
        ) : view === 'preview' ? (
          <PreviewFrame doc={html} title="Response preview" />
        ) : view === 'tree' ? (
          tree === null ? (
            <Alert severity="warning" sx={{ m: 1.5 }}>
              The body is not valid JSON.
            </Alert>
          ) : (
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <JsonViewer value={tree} ariaLabel="Response JSON tree" />
            </Box>
          )
        ) : view === 'pretty' && isJson ? (
          pretty.status === 'error' ? (
            <CodeEditor value={text} readOnly language="plaintext" ariaLabel="Response body" />
          ) : pretty.result !== undefined && pretty.status === 'success' ? (
            <CodeEditor value={pretty.result} readOnly language="json" ariaLabel="Response body" />
          ) : (
            <LoadingState />
          )
        ) : (
          <CodeEditor
            value={text}
            readOnly
            language={view === 'raw' ? 'plaintext' : languageOf(r.contentType, text)}
            ariaLabel="Response body"
            wordWrap={view === 'raw'}
          />
        )}
      </Box>
    </Box>
  );
}

/** Response panel: status, timing, size, body views, headers and the request as sent. */
export function ResponseViewer({ state, onCancel }: { state: SendState; onCancel: () => void }) {
  const [tab, setTab] = useState(0);
  const r = state.response;
  return (
    <Panel
      title="Response"
      busy={state.status === 'sending'}
      meta={
        r ? (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Chip
              size="small"
              color={statusColor(r.status)}
              label={`${String(r.status)} ${r.statusText}`.trim()}
              aria-label="Status"
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${String(r.timings.totalMs)} ms`}
              aria-label="Time"
            />
            <Chip
              size="small"
              variant="outlined"
              label={formatBytes(r.sizeBytes)}
              aria-label="Size"
            />
          </Stack>
        ) : undefined
      }
    >
      {state.status === 'idle' && (
        <EmptyState
          dense
          title="No response yet"
          description="Enter a URL and press Send (Ctrl/⌘+Enter)."
        />
      )}
      {state.status === 'sending' && (
        <Stack spacing={1.5} sx={{ p: 3, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Waiting for the response…
          </Typography>
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Stack>
      )}
      {state.status === 'cancelled' && (
        <Alert severity="info" sx={{ m: 1.5 }}>
          The request was cancelled.
        </Alert>
      )}
      {state.status === 'error' && (
        <Alert severity="error" role="alert" sx={{ m: 1.5 }}>
          <AlertTitle>
            {state.errorCode === 'CORS'
              ? 'No response (blocked or unreachable)'
              : state.errorCode === 'TIMEOUT'
                ? 'Timed out'
                : 'The request could not be sent'}
          </AlertTitle>
          {state.error}
        </Alert>
      )}
      {(r || (state.status === 'error' && state.prepared)) && (
        <>
          <Tabs
            value={r ? tab : 2}
            onChange={(_, v: number) => {
              setTab(v);
            }}
            sx={{ px: 1.5, minHeight: 40, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Body" disabled={!r} sx={{ minHeight: 40 }} />
            <Tab
              label={`Headers${r ? ` (${String(r.headers.length)})` : ''}`}
              disabled={!r}
              sx={{ minHeight: 40 }}
            />
            <Tab label="Request" sx={{ minHeight: 40 }} />
          </Tabs>
          {r && tab === 0 && (
            <ResponseBody
              key={`${String(r.timings.totalMs)}-${String(r.sizeBytes)}-${r.url}`}
              r={r}
            />
          )}
          {r && tab === 1 && (
            <Box sx={{ overflow: 'auto', p: 1 }}>
              <KvTable label="Response headers" rows={r.headers} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 1 }}>
                Browsers only expose headers the server lists in Access-Control-Expose-Headers (plus
                a few safe ones) for cross-origin responses, and never Set-Cookie.
              </Typography>
            </Box>
          )}
          {(!r || tab === 2) && state.prepared && <SentRequest p={state.prepared} />}
        </>
      )}
    </Panel>
  );
}
