import { IconButton, Tooltip } from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { FolderOpen, Save2 } from 'iconsax-reactjs';
import { type ReactNode, useState } from 'react';
import { type EditorMarker, type RevealRequest, useNotify } from '@/components';
import { JsonInputPanel } from '@/components/workspace/JsonInputPanel';
import { OpenSavedDialog, SaveNameDialog } from '@/components/workspace/SavedItemDialogs';
import type { ParseError } from '@/core/errors/AppError';
import { SQL_FILE_RULES } from '@/core/files/fileValidation';
import { formatBytes } from '@/core/format/bytes';
import { DIALECTS } from '@/core/sql/dialects';
import { savedQueriesRepository } from '@/services/db/repositories/savedQueriesRepository';
import { type SqlWorkspaceState, useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';

type Field = 'sql' | 'right' | 'schema';

/** SQL editor bound to the shared SQL workspace, with Open/Save of saved queries. */
export function SqlInput({
  field,
  title,
  sample,
  error,
  valid,
  markers,
  reveal,
  onRun,
  saved = false,
  extraActions,
}: {
  field: Field;
  title: string;
  sample?: string;
  error?: ParseError | null;
  valid?: boolean;
  markers?: readonly EditorMarker[];
  reveal?: RevealRequest | null;
  onRun?: () => void;
  /** Offer Open/Save of saved queries. */
  saved?: boolean;
  extraActions?: ReactNode;
}) {
  const value = useSqlWorkspaceStore((s: SqlWorkspaceState) => s[field]);
  const dialect = useSqlWorkspaceStore((s) => s.dialect);
  const current = useSqlWorkspaceStore((s) => (field === 'sql' ? s.query : null));
  const set = useSqlWorkspaceStore((s) => s.set);
  const notify = useNotify();
  const [openDialog, setOpenDialog] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [query, setQuery] = useState('');
  const items = useLiveQuery(
    () => (openDialog ? savedQueriesRepository.list('query', query) : Promise.resolve([])),
    [openDialog, query],
  );

  return (
    <>
      <JsonInputPanel
        title={title}
        value={value}
        onChange={(v) => {
          set({ [field]: v });
        }}
        language="sql"
        rules={SQL_FILE_RULES}
        {...(sample !== undefined ? { sample } : {})}
        {...(error !== undefined ? { error } : {})}
        {...(valid !== undefined ? { valid } : {})}
        {...(markers ? { markers } : {})}
        {...(reveal !== undefined ? { reveal } : {})}
        {...(onRun ? { onRun } : {})}
        extraActions={
          <>
            {extraActions}
            {saved && (
              <>
                <Tooltip title="Open saved query">
                  <IconButton
                    size="small"
                    aria-label="Open saved query"
                    onClick={() => {
                      setOpenDialog(true);
                    }}
                  >
                    <FolderOpen size={18} color="currentColor" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Save query">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Save query"
                      disabled={!value.trim()}
                      onClick={() => {
                        setSaveDialog(true);
                      }}
                    >
                      <Save2 size={18} color="currentColor" />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}
          </>
        }
      />
      {saved && (
        <>
          <OpenSavedDialog
            open={openDialog}
            title="Open saved query"
            noun="query"
            emptyHint="Use “Save query” to keep SQL scripts in this browser."
            query={query}
            onQueryChange={setQuery}
            items={items?.map((q) => ({
              ...q,
              description: `${DIALECTS[q.dialect].label} · ${formatBytes(typeof q.content === 'string' ? q.content.length : q.content.byteLength)} · updated ${formatDistanceToNowStrict(q.updatedAt, { addSuffix: true })}`,
            }))}
            onClose={() => {
              setOpenDialog(false);
            }}
            onOpen={(q) => {
              if (typeof q.content !== 'string') return;
              set({
                [field]: q.content,
                dialect: q.dialect,
                ...(field === 'sql' ? { query: { id: q.id, name: q.name } } : {}),
              });
              setOpenDialog(false);
              notify.info(`Opened "${q.name}"`);
            }}
            onDelete={(q) => savedQueriesRepository.remove(q.id)}
          />
          <SaveNameDialog
            open={saveDialog}
            title={current ? 'Save query' : 'Save as query'}
            initialName={current?.name ?? `Query ${new Date().toLocaleString()}`}
            helperText={`${DIALECTS[dialect].label} · ${formatBytes(value.length)} · stored only in this browser`}
            canSaveAsNew={current !== null}
            onClose={() => {
              setSaveDialog(false);
            }}
            onSave={async (name, asNew) => {
              const q = await savedQueriesRepository.save({
                ...(current && !asNew ? { id: current.id } : {}),
                name,
                dialect,
                kind: 'query',
                content: value,
              });
              if (field === 'sql') set({ query: { id: q.id, name: q.name } });
              setSaveDialog(false);
              notify.success(`Saved "${q.name}"`);
            }}
          />
        </>
      )}
    </>
  );
}
