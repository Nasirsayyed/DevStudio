import { Alert, IconButton, Tooltip } from '@mui/material';
import { ArchiveBook } from 'iconsax-reactjs';
import { type ReactNode, useCallback } from 'react';
import { SplitPane, ToolWorkspace, useNotify } from '@/components';
import { JsonInputPanel } from '@/components/workspace/JsonInputPanel';
import { OutputPanel } from '@/components/workspace/OutputPanel';
import type { GeneratedFile } from '@/core/codegen/model';
import { toUserMessage } from '@/core/errors/AppError';
import { XML_FILE_RULES } from '@/core/files/fileValidation';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import { useJsonDocumentFromUrl } from '@/hooks/useJsonDocumentFromUrl';
import { type OperationState, parseErrorFor } from '@/hooks/useTaskOperation';
import { downloadZip } from '@/services/files/zip';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { requireTool } from '@/tools/toolRegistry';

export interface CodegenOutput {
  text: string;
  /** Multiple files enable "Download as ZIP". */
  files?: readonly GeneratedFile[];
  /** Informational notes shown above the output. */
  notes?: readonly string[];
}

export interface CodegenLayoutProps<R> {
  toolId: string;
  toolbar: ReactNode;
  state: OperationState<R>;
  getOutput: (result: R) => CodegenOutput;
  outputLanguage: string;
  outputFilename: string;
  outputMime?: string;
  zipName?: string;
  historyOptions?: object;
  /** Input: the shared JSON document (default) or the XML input. */
  inputKind?: 'json' | 'xml';
  sample?: string;
  /** Offers to load the output (JSON) as the shared JSON document. */
  outputIsJson?: boolean;
}

const XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<order id="1001" status="paid">
  <customer>
    <name>Ahmed</name>
    <email>ahmed@example.com</email>
  </customer>
  <items>
    <item sku="KB-001" quantity="1">Mechanical keyboard</item>
    <item sku="MS-042" quantity="2">Wireless mouse</item>
  </items>
  <total currency="USD">2500.50</total>
</order>
`;

/** Shared layout of every generator: input (left) → generated code (right). */
export function CodegenLayout<R>({
  toolId,
  toolbar,
  state,
  getOutput,
  outputLanguage,
  outputFilename,
  outputMime = 'text/plain',
  zipName,
  historyOptions,
  inputKind = 'json',
  sample,
  outputIsJson = false,
}: CodegenLayoutProps<R>) {
  const tool = requireTool(toolId);
  useJsonDocumentFromUrl();
  const json = useJsonWorkspaceStore((s) => s.input);
  const xml = useJsonWorkspaceStore((s) => s.xml);
  const setJson = useJsonWorkspaceStore((s) => s.setInput);
  const setXml = useJsonWorkspaceStore((s) => s.setXml);
  const loadDocument = useJsonWorkspaceStore((s) => s.loadDocument);
  const notify = useNotify();
  const record = useHistoryRecorder(toolId);
  const input = inputKind === 'xml' ? xml : json;
  const output =
    state.result !== undefined && state.status === 'success' ? getOutput(state.result) : undefined;
  const text = state.result !== undefined ? getOutput(state.result).text : undefined;

  const onExported = useCallback(
    (kind: 'copy' | 'download' | 'zip') => {
      if (text !== undefined) record(`${tool.title} (${kind})`, input, text, historyOptions);
    },
    [text, record, tool.title, input, historyOptions],
  );

  const files = output?.files ?? [];
  const zipAction =
    files.length > 1 ? (
      <Tooltip title={`Download ${files.length} files as ZIP`}>
        <IconButton
          size="small"
          aria-label="Download as ZIP"
          onClick={() => {
            downloadZip(files, zipName ?? `${tool.slug}.zip`)
              .then(() => {
                onExported('zip');
              })
              .catch((error: unknown) => {
                notify.error(toUserMessage(error, 'Could not create the ZIP file.'));
              });
          }}
        >
          <ArchiveBook size={18} color="currentColor" />
        </IconButton>
      </Tooltip>
    ) : null;

  const notes = output?.notes ?? [];
  return (
    <ToolWorkspace tool={tool} toolbar={toolbar}>
      <SplitPane
        storageKey={toolId}
        first={
          inputKind === 'xml' ? (
            <JsonInputPanel
              title="XML input"
              value={xml}
              onChange={setXml}
              language="xml"
              rules={XML_FILE_RULES}
              sample={sample ?? XML_SAMPLE}
              error={parseErrorFor(state.error)}
              valid={state.status === 'success'}
              onRun={state.run}
            />
          ) : (
            <JsonInputPanel
              title="JSON input"
              value={json}
              onChange={setJson}
              documents
              sample={sample ?? SAMPLE_ORDER_JSON}
              error={parseErrorFor(state.error)}
              valid={state.status === 'success'}
              onRun={state.run}
            />
          )
        }
        second={
          <OutputPanel
            title="Generated code"
            state={state}
            text={text}
            language={outputLanguage}
            filename={outputFilename}
            mimeType={outputMime}
            onExported={onExported}
            extraActions={zipAction}
            wordWrap={outputIsJson}
            onUseAsInput={
              outputIsJson
                ? (t) => {
                    loadDocument(t, null);
                    notify.info(
                      'Loaded as the JSON document (available in JSON Studio and all generators).',
                    );
                  }
                : undefined
            }
            useAsInputLabel="Use as JSON document"
            emptyHint={
              inputKind === 'xml'
                ? 'Paste, type, drop or open XML on the left.'
                : 'Paste, type, drop or open JSON on the left to generate code.'
            }
            warnings={
              notes.length > 0 ? (
                <Alert severity="info" variant="outlined" sx={{ m: 1.5, mb: 0, borderRadius: 2 }}>
                  {notes.slice(0, 4).join(' ')}
                  {notes.length > 4 ? ` (+${notes.length - 4} more)` : ''}
                </Alert>
              ) : null
            }
          />
        }
      />
    </ToolWorkspace>
  );
}
