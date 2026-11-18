import {
  Alert,
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Stop } from 'iconsax-reactjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  CopyButton,
  EmptyState,
  Kbd,
  Panel,
  SplitPane,
  ToolWorkspace,
  useNotify,
} from '@/components';
import { DataGrid } from '@/components/data-display/DataGrid';
import { DownloadButton } from '@/components/inputs/DownloadButton';
import { UploadButton } from '@/components/inputs/FileDropZone';
import { JsonInputPanel } from '@/components/workspace/JsonInputPanel';
import { OpenSavedDialog, SaveNameDialog } from '@/components/workspace/SavedItemDialogs';
import { toUserMessage } from '@/core/errors/AppError';
import { SQL_FILE_RULES, SQLITE_FILE_RULES } from '@/core/files/fileValidation';
import { formatBytes } from '@/core/format/bytes';
import { jsonToCsv } from '@/core/json/csv';
import type { JsonObject } from '@/core/json/types';
import type { SqliteCell, SqliteObject, SqliteResult, SqliteRun } from '@/core/sqlite/protocol';
import { savedQueriesRepository } from '@/services/db/repositories/savedQueriesRepository';
import { downloadBytes, readFileBytes } from '@/services/files/textFiles';
import { createSqliteConnection, type SqliteConnection } from '@/services/sqlite/sqliteClient';
import { hydrateSqlWorkspaceDraft, useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { requireTool } from '@/tools/toolRegistry';
import { SAMPLE_PLAYGROUND } from '../samples';

/** Queries run in a worker (and can be stopped) wherever workers exist. */
const CAN_STOP = typeof Worker !== 'undefined';

interface DbInfo {
  name: string;
  savedId: string | null;
  modified: boolean;
}

function toCsv(r: SqliteResult): string {
  const rows = r.rows.map(
    (row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i] ?? null])) as JsonObject,
  );
  return jsonToCsv(rows, { escapeFormulae: true }).csv;
}

function ResultSet({ r, index }: { r: SqliteResult; index: number }) {
  const label = `Result ${String(index + 1)}`;
  return (
    <Box
      component="section"
      aria-label={label}
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle2" component="h3" sx={{ flex: 1 }} noWrap title={r.sql}>
          {label}: {r.totalRows.toLocaleString()} {r.totalRows === 1 ? 'row' : 'rows'}
          {r.totalRows > r.rows.length
            ? ` (showing the first ${r.rows.length.toLocaleString()})`
            : ''}{' '}
          · {r.durationMs} ms
        </Typography>
        <CopyButton label={`Copy ${label} as CSV`} value={() => toCsv(r)} />
        <DownloadButton
          content={() => toCsv(r)}
          filename={`result-${String(index + 1)}.csv`}
          mimeType="text/csv"
          label={`Download ${label} as CSV`}
        />
      </Stack>
      <DataGrid<SqliteCell[]>
        ariaLabel={label}
        rows={r.rows}
        rowKey={(_, i) => String(i)}
        height={Math.min(360, 40 + r.rows.length * 32)}
        emptyMessage="No rows."
        columns={r.columns.map((c, i) => ({
          id: `${String(i)}:${c}`,
          header: c,
          mono: true,
          getValue: (row) => row[i] ?? null,
          render: (row) =>
            row[i] === null ? (
              <Typography component="span" variant="body2" color="text.disabled">
                NULL
              </Typography>
            ) : (
              String(row[i])
            ),
        }))}
      />
    </Box>
  );
}

export default function SqlitePlaygroundPage() {
  const tool = requireTool('sql.playground');
  const script = useSqlWorkspaceStore((s) => s.playground);
  const set = useSqlWorkspaceStore((s) => s.set);
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const connRef = useRef<SqliteConnection | null>(null);
  const [db, setDb] = useState<DbInfo>({ name: 'New database', savedId: null, modified: false });
  const [run, setRun] = useState<SqliteRun | null>(null);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [schema, setSchema] = useState<SqliteObject[]>([]);
  const [tab, setTab] = useState(0);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [openSaved, setOpenSaved] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedQuery, setSavedQuery] = useState('');
  const savedDbs = useLiveQuery(
    () =>
      openSaved ? savedQueriesRepository.summaries('sqliteDb', savedQuery) : Promise.resolve([]),
    [openSaved, savedQuery],
  );

  const conn = useCallback((): SqliteConnection => {
    connRef.current ??= createSqliteConnection();
    return connRef.current;
  }, []);

  const refreshSchema = useCallback(async () => {
    setSchema(await conn().schema());
  }, [conn]);

  const openDb = useCallback(
    async (bytes: Uint8Array | null, info: DbInfo) => {
      await conn().open(bytes);
      setDb(info);
      setRun(null);
      await refreshSchema();
    },
    [conn, refreshSchema],
  );

  useEffect(() => {
    void hydrateSqlWorkspaceDraft();
    return () => {
      connRef.current?.dispose();
      connRef.current = null;
    };
  }, []);

  // ?query=<id> opens a saved database (links from the command palette).
  const id = params.get('query');
  useEffect(() => {
    if (!id) return;
    savedQueriesRepository
      .get(id)
      .then(async (q) => {
        if (q?.kind === 'sqliteDb' && typeof q.content !== 'string') {
          await openDb(q.content, { name: q.name, savedId: q.id, modified: false });
          notify.info(`Opened "${q.name}"`);
        } else notify.warning('That saved database no longer exists.');
        setParams(
          (p) => {
            p.delete('query');
            return p;
          },
          { replace: true },
        );
      })
      .catch((error: unknown) => {
        notify.error(toUserMessage(error));
      });
  }, [id, notify, openDb, setParams]);

  const execute = async () => {
    if (!script.trim() || running) return;
    setRunning(true);
    setStopped(false);
    try {
      const result = await conn().exec(script);
      setRun(result);
      setTab(0);
      const changed = result.results.some((r) => r.rowsModified > 0 || r.columns.length === 0);
      if (changed) setDb((d) => ({ ...d, modified: true }));
      await refreshSchema();
    } catch (error) {
      if (!(error instanceof Error && /stopped/.test(error.message)))
        notify.error(toUserMessage(error));
    } finally {
      setRunning(false);
    }
  };

  const stop = async () => {
    setStopped(true);
    await conn().stop();
    setRunning(false);
    await refreshSchema();
  };

  const save = async (name: string, asNew: boolean) => {
    const bytes = await conn().export();
    const saved = await savedQueriesRepository.save({
      ...(db.savedId && !asNew ? { id: db.savedId } : {}),
      name,
      dialect: 'sqlite',
      kind: 'sqliteDb',
      content: bytes,
    });
    setDb({ name: saved.name, savedId: saved.id, modified: false });
    setSaveOpen(false);
    notify.success(`Saved "${saved.name}" (${formatBytes(bytes.byteLength)}) in this browser.`);
  };

  const messages = run?.results.filter((r) => r.columns.length === 0 && r.rowsModified > 0) ?? [];
  const resultSets = run?.results.filter((r) => r.columns.length > 0) ?? [];

  return (
    <ToolWorkspace
      tool={tool}
      toolbar={
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Button
            variant="contained"
            startIcon={<Play size={16} color="currentColor" />}
            disabled={running || !script.trim()}
            onClick={() => void execute()}
          >
            Run
          </Button>
          {running && CAN_STOP && (
            <Button
              color="error"
              startIcon={<Stop size={16} color="currentColor" />}
              onClick={() => void stop()}
            >
              Stop
            </Button>
          )}
          <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            <Kbd combo="mod+enter" size="small" />
          </Box>
          <Box sx={{ flex: 1 }} />
          <Chip
            label={`${db.name}${db.modified ? ' · unsaved changes' : ''}`}
            color={db.modified ? 'warning' : 'default'}
            variant="outlined"
            aria-label="Database"
          />
          <Button
            aria-haspopup="menu"
            onClick={(e) => {
              setMenu(e.currentTarget);
            }}
          >
            Database
          </Button>
          <Menu
            anchorEl={menu}
            open={menu !== null}
            onClose={() => {
              setMenu(null);
            }}
          >
            <MenuItem
              onClick={() => {
                setMenu(null);
                void openDb(null, { name: 'New database', savedId: null, modified: false });
              }}
            >
              New empty database
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenu(null);
                setOpenSaved(true);
              }}
            >
              Open saved database…
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenu(null);
                setSaveOpen(true);
              }}
            >
              Save in this browser…
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenu(null);
                conn()
                  .export()
                  .then((bytes) => {
                    downloadBytes(
                      bytes,
                      `${db.name.replace(/[^\p{L}\p{N}._-]+/gu, '-') || 'database'}.sqlite`,
                      'application/vnd.sqlite3',
                    );
                  })
                  .catch((error: unknown) => {
                    notify.error(toUserMessage(error));
                  });
              }}
            >
              Download .sqlite file
            </MenuItem>
          </Menu>
          <UploadButton
            label="Open .sqlite file"
            rules={SQLITE_FILE_RULES}
            onText={() => undefined}
            onError={notify.error}
            onFile={(file) => {
              readFileBytes(file, SQLITE_FILE_RULES.maxBytes)
                .then((bytes) =>
                  openDb(bytes, {
                    name: file.name.replace(/\.(sqlite3?|db3?)$/i, ''),
                    savedId: null,
                    modified: false,
                  }),
                )
                .then(() => {
                  notify.info(`Opened ${file.name}`);
                })
                .catch((error: unknown) => {
                  notify.error(toUserMessage(error));
                });
            }}
          />
        </Stack>
      }
    >
      <SplitPane
        storageKey="sql.playground"
        first={
          <JsonInputPanel
            title="SQL script"
            value={script}
            onChange={(v) => {
              set({ playground: v });
            }}
            language="sql"
            rules={SQL_FILE_RULES}
            sample={SAMPLE_PLAYGROUND}
            onRun={() => void execute()}
          />
        }
        second={
          <Panel
            title="Results"
            busy={running}
            meta={
              run ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${String(run.executed)} statements · ${String(run.durationMs)} ms`}
                  sx={{ height: 20, fontSize: 11 }}
                />
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
              <Tab label="Results" sx={{ minHeight: 40 }} />
              <Tab label={`Schema (${String(schema.length)})`} sx={{ minHeight: 40 }} />
            </Tabs>
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.5 }}>
              {tab === 0 ? (
                <Stack spacing={2}>
                  {stopped && (
                    <Alert severity="info">
                      The query was stopped. The database was restored to the state it had when it
                      was opened or last saved.
                    </Alert>
                  )}
                  {run?.error && (
                    <Alert severity="error" role="alert">
                      <strong>{run.error.message}</strong>
                      {run.error.statement && (
                        <Box
                          component="pre"
                          sx={{ m: 0, mt: 0.5, whiteSpace: 'pre-wrap', fontSize: 12 }}
                        >
                          {run.error.statement}
                        </Box>
                      )}
                      {run.executed > 0 &&
                        `The ${String(run.executed)} statement(s) before it ran.`}
                    </Alert>
                  )}
                  {messages.length > 0 && (
                    <Alert severity="success">
                      {messages
                        .map(
                          (m) =>
                            `${m.rowsModified.toLocaleString()} ${m.rowsModified === 1 ? 'row' : 'rows'} changed`,
                        )
                        .join(' · ')}
                    </Alert>
                  )}
                  {resultSets.map((r, i) => (
                    <ResultSet key={`${String(i)}-${r.sql}`} r={r} index={i} />
                  ))}
                  {!run && !stopped && (
                    <EmptyState
                      dense
                      title="Run SQL against SQLite in your browser"
                      description="Load the sample, open a .sqlite file, or write CREATE TABLE and SELECT statements. Nothing leaves this browser."
                    />
                  )}
                  {run && !run.error && resultSets.length === 0 && messages.length === 0 && (
                    <Alert severity="success">Done. The statements returned no rows.</Alert>
                  )}
                </Stack>
              ) : schema.length === 0 ? (
                <EmptyState
                  dense
                  title="No tables yet"
                  description="Create tables with CREATE TABLE."
                />
              ) : (
                <List dense aria-label="Tables and views">
                  {schema.map((o) => (
                    <li key={o.name}>
                      <ListItemButton
                        onClick={() => {
                          set({
                            playground: `SELECT * FROM "${o.name.replace(/"/g, '""')}" LIMIT 100;`,
                          });
                          notify.info(`Query for ${o.name} is in the editor; press Run.`);
                        }}
                      >
                        <ListItemText
                          primary={
                            <>
                              <strong>{o.name}</strong>{' '}
                              {o.type === 'view' ? '(view)' : `· ${String(o.rows ?? 0)} rows`}
                            </>
                          }
                          secondary={o.columns
                            .map(
                              (c) =>
                                `${c.name}${c.type ? ` ${c.type}` : ''}${c.primaryKey ? ' PK' : ''}${c.notNull ? ' NOT NULL' : ''}`,
                            )
                            .join(', ')}
                        />
                      </ListItemButton>
                    </li>
                  ))}
                </List>
              )}
            </Box>
          </Panel>
        }
      />
      <OpenSavedDialog
        open={openSaved}
        title="Open saved database"
        noun="database"
        emptyHint="Use Database → Save in this browser to keep a database."
        query={savedQuery}
        onQueryChange={setSavedQuery}
        items={savedDbs?.map((q) => ({
          ...q,
          description: `${formatBytes(q.size)} · updated ${formatDistanceToNowStrict(q.updatedAt, { addSuffix: true })}`,
        }))}
        onClose={() => {
          setOpenSaved(false);
        }}
        onOpen={(summary) => {
          setOpenSaved(false);
          savedQueriesRepository
            .get(summary.id)
            .then(async (q) => {
              if (!q || typeof q.content === 'string') {
                notify.warning('That saved database no longer exists.');
                return;
              }
              await openDb(q.content, { name: q.name, savedId: q.id, modified: false });
              notify.info(`Opened "${q.name}"`);
            })
            .catch((error: unknown) => {
              notify.error(toUserMessage(error));
            });
        }}
        onDelete={(q) => savedQueriesRepository.remove(q.id)}
      />
      <SaveNameDialog
        open={saveOpen}
        title="Save database in this browser"
        initialName={db.name}
        helperText="Stored in IndexedDB on this device (up to 100 MB)."
        canSaveAsNew={db.savedId !== null}
        onClose={() => {
          setSaveOpen(false);
        }}
        onSave={save}
      />
    </ToolWorkspace>
  );
}
