import {
  Alert,
  Box,
  Button,
  Checkbox,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DocumentUpload, Trash } from 'iconsax-reactjs';
import { useRef } from 'react';
import { CodeEditor } from '@/components';
import { formatBytes } from '@/core/format/bytes';
import {
  BODY_MODES,
  type BodyMode,
  type FormDataEntry,
  type RequestBody,
  rowId,
} from '@/core/http/model';
import { useApiWorkspaceStore } from '@/stores/apiWorkspaceStore';
import { KeyValueEditor } from './KeyValueEditor';

const LABEL: Record<BodyMode, string> = {
  none: 'None',
  json: 'JSON',
  text: 'Text',
  xml: 'XML',
  'form-urlencoded': 'URL-encoded',
  'form-data': 'Form data',
  graphql: 'GraphQL',
  binary: 'File',
};

function FilePicker({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null | undefined;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        hidden
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      <Button
        size="small"
        variant="outlined"
        startIcon={<DocumentUpload size={16} color="currentColor" />}
        onClick={() => ref.current?.click()}
        sx={{ flexShrink: 0 }}
      >
        {file ? `${file.name} (${formatBytes(file.size)})` : 'Choose file'}
      </Button>
    </>
  );
}

function FormDataEditor({
  entries,
  onChange,
}: {
  entries: FormDataEntry[];
  onChange: (e: FormDataEntry[]) => void;
}) {
  const files = useApiWorkspaceStore((s) => s.files);
  const set = useApiWorkspaceStore((s) => s.set);
  const update = (id: string, patch: Partial<FormDataEntry>) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  return (
    <Stack spacing={0.5} role="group" aria-label="Form fields">
      {entries.map((e, i) => (
        <Stack key={e.id} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Checkbox
            size="small"
            checked={e.enabled}
            onChange={(ev) => {
              update(e.id, { enabled: ev.target.checked });
            }}
            slotProps={{ input: { 'aria-label': `Enable form field ${String(i + 1)}` } }}
          />
          <TextField
            size="small"
            placeholder="Key"
            value={e.key}
            onChange={(ev) => {
              update(e.id, { key: ev.target.value });
            }}
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { 'aria-label': `Form field name ${String(i + 1)}` } }}
          />
          <TextField
            select
            size="small"
            value={e.type}
            onChange={(ev) => {
              update(e.id, { type: ev.target.value === 'file' ? 'file' : 'text', value: '' });
            }}
            sx={{ width: 90 }}
            slotProps={{ htmlInput: { 'aria-label': `Form field type ${String(i + 1)}` } }}
          >
            <MenuItem value="text">Text</MenuItem>
            <MenuItem value="file">File</MenuItem>
          </TextField>
          {e.type === 'text' ? (
            <TextField
              size="small"
              placeholder="Value"
              value={e.value}
              onChange={(ev) => {
                update(e.id, { value: ev.target.value });
              }}
              sx={{ flex: 1.4 }}
              slotProps={{ htmlInput: { 'aria-label': `Form field value ${String(i + 1)}` } }}
            />
          ) : (
            <Box sx={{ flex: 1.4, minWidth: 0 }}>
              <FilePicker
                label={`File for form field ${String(i + 1)}`}
                file={files[e.id]}
                onFile={(f) => {
                  set({ files: { ...files, [e.id]: f } });
                  update(e.id, { value: f.name });
                }}
              />
            </Box>
          )}
          <IconButton
            size="small"
            aria-label={`Remove form field ${String(i + 1)}`}
            onClick={() => {
              onChange(entries.filter((x) => x.id !== e.id));
            }}
          >
            <Trash size={16} color="currentColor" />
          </IconButton>
        </Stack>
      ))}
      <Button
        size="small"
        sx={{ alignSelf: 'flex-start' }}
        onClick={() => {
          onChange([...entries, { id: rowId(), key: '', value: '', type: 'text', enabled: true }]);
        }}
      >
        Add field
      </Button>
      {entries.some((e) => e.type === 'file' && !files[e.id]) && (
        <Alert severity="info" sx={{ py: 0 }}>
          Files are not saved with the request; choose them again after reopening it.
        </Alert>
      )}
    </Stack>
  );
}

export function BodyEditor({
  body,
  onChange,
  disabled,
}: {
  body: RequestBody;
  onChange: (b: RequestBody) => void;
  disabled: boolean;
}) {
  const binaryFile = useApiWorkspaceStore((s) => s.binaryFile);
  const set = useApiWorkspaceStore((s) => s.set);
  const raw = (language: string) => (
    <Box
      sx={{ height: 260, border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}
    >
      <CodeEditor
        value={body.raw}
        onChange={(raw2) => {
          onChange({ ...body, raw: raw2 });
        }}
        language={language}
        ariaLabel="Request body"
      />
    </Box>
  );
  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={body.mode}
        aria-label="Body type"
        onChange={(_, v: BodyMode | null) => {
          if (v) onChange({ ...body, mode: v });
        }}
        sx={{ flexWrap: 'wrap' }}
      >
        {BODY_MODES.map((m) => (
          <ToggleButton key={m} value={m} sx={{ px: 1.25, py: 0.25, textTransform: 'none' }}>
            {LABEL[m]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {disabled && body.mode !== 'none' && (
        <Alert severity="warning">
          GET and HEAD requests cannot have a body in browsers. Choose another method or "None".
        </Alert>
      )}
      {body.mode === 'none' && (
        <Typography variant="body2" color="text.secondary">
          This request has no body.
        </Typography>
      )}
      {body.mode === 'json' && raw('json')}
      {body.mode === 'text' && raw('plaintext')}
      {body.mode === 'xml' && raw('xml')}
      {body.mode === 'form-urlencoded' && (
        <KeyValueEditor
          label="Form fields"
          rows={body.form}
          onChange={(form) => {
            onChange({ ...body, form });
          }}
        />
      )}
      {body.mode === 'form-data' && (
        <FormDataEditor
          entries={body.formData}
          onChange={(formData) => {
            onChange({ ...body, formData });
          }}
        />
      )}
      {body.mode === 'graphql' && (
        <Stack spacing={1}>
          <Box
            sx={{
              height: 200,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5,
              overflow: 'hidden',
            }}
          >
            <CodeEditor
              value={body.graphql.query}
              onChange={(query) => {
                onChange({ ...body, graphql: { ...body.graphql, query } });
              }}
              language="graphql"
              ariaLabel="GraphQL query"
            />
          </Box>
          <Box
            sx={{
              height: 120,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5,
              overflow: 'hidden',
            }}
          >
            <CodeEditor
              value={body.graphql.variables}
              onChange={(variables) => {
                onChange({ ...body, graphql: { ...body.graphql, variables } });
              }}
              language="json"
              ariaLabel="GraphQL variables"
            />
          </Box>
        </Stack>
      )}
      {body.mode === 'binary' && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <FilePicker
            label="File to send"
            file={binaryFile}
            onFile={(f) => {
              set({ binaryFile: f });
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Sent as the raw body; not saved with the request.
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
