import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  Tabs,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  CodeEditor,
  CopyButton,
  EmptyState,
  Panel,
  SplitPane,
  ToolWorkspace,
  useConfirm,
  useNotify,
} from '@/components';
import { DownloadButton } from '@/components/inputs/DownloadButton';
import { UploadButton } from '@/components/inputs/FileDropZone';
import { OptionsBar, SwitchOption } from '@/components/workspace/OptionControls';
import { OpenSavedDialog, SaveNameDialog } from '@/components/workspace/SavedItemDialogs';
import { toUserMessage } from '@/core/errors/AppError';
import { JSON_FILE_RULES } from '@/core/files/fileValidation';
import {
  designFromTables,
  emptyDesign,
  generateDdl,
  parseDesign,
  type SchemaDesign,
  validateDesign,
} from '@/core/sql/design';
import { DIALECTS } from '@/core/sql/dialects';
import { parseTables } from '@/core/sql/schema';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { savedQueriesRepository } from '@/services/db/repositories/savedQueriesRepository';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { requireTool } from '@/tools/toolRegistry';
import { DesignEditor } from '../components/DesignEditor';
import { DialectSelect } from '../components/DialectSelect';
import { SchemaDiagram } from '../components/SchemaDiagram';
import { useSqlDraft } from '../hooks';
import { sampleSchema } from '../samples';

function ImportDdlDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (design: SchemaDesign, mode: 'replace' | 'merge') => void;
}) {
  const dialect = useSqlWorkspaceStore((s) => s.dialect);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="import-ddl-title"
    >
      <DialogTitle id="import-ddl-title">Import CREATE TABLE statements</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Box
            sx={{
              height: 280,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <CodeEditor
              value={text}
              onChange={setText}
              language="sql"
              ariaLabel="CREATE TABLE statements to import"
            />
          </Box>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Chip size="small" label={`Parsed as ${DIALECTS[dialect].label}`} />
            <Button
              size="small"
              onClick={() => {
                setText(sampleSchema(dialect));
              }}
            >
              Use the sample
            </Button>
            <RadioGroup
              row
              value={mode}
              onChange={(e) => {
                setMode(e.target.value === 'merge' ? 'merge' : 'replace');
              }}
            >
              <FormControlLabel
                value="replace"
                control={<Radio size="small" />}
                label="Replace the design"
              />
              <FormControlLabel
                value="merge"
                control={<Radio size="small" />}
                label="Add to the design"
              />
            </RadioGroup>
          </Stack>
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!text.trim()}
          onClick={() => {
            try {
              onImport(designFromTables(parseTables(text, dialect)), mode);
              setText('');
              setError(null);
            } catch (e) {
              setError(toUserMessage(e));
            }
          }}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SchemaDesignerPage() {
  useSqlDraft();
  const tool = requireTool('sql.schema-designer');
  const design = useSqlWorkspaceStore((s) => s.design);
  const dialect = useSqlWorkspaceStore((s) => s.dialect);
  const set = useSqlWorkspaceStore((s) => s.set);
  const notify = useNotify();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [opts, setOpts] = usePersistentOptions<{ dropExisting: boolean; quoteAll: boolean }>(
    'sql.schema-designer',
    { dropExisting: false, quoteAll: false },
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [current, setCurrent] = useState<{ id: string; name: string } | null>(null);
  const [openSaved, setOpenSaved] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedQuery, setSavedQuery] = useState('');
  const saved = useLiveQuery(
    () =>
      openSaved ? savedQueriesRepository.summaries('schema', savedQuery) : Promise.resolve([]),
    [openSaved, savedQuery],
  );

  const update = (d: SchemaDesign) => {
    set({ design: d });
  };
  const issues = useMemo(() => validateDesign(design), [design]);
  const ddl = useMemo(() => {
    try {
      return { ...generateDdl(design, dialect, opts), error: null };
    } catch (e) {
      return { sql: '', notes: [], error: toUserMessage(e) };
    }
  }, [design, dialect, opts]);
  const errors = issues.filter((i) => i.severity === 'error').length;

  // ?query=<id> from the command palette opens a saved design.
  const id = params.get('query');
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    savedQueriesRepository
      .get(id)
      .then((q) => {
        if (cancelled) return;
        if (q?.kind === 'schema' && typeof q.content === 'string') {
          set({ design: parseDesign(q.content), dialect: q.dialect });
          setCurrent({ id: q.id, name: q.name });
          notify.info(`Opened "${q.name}"`);
        } else notify.warning('That saved design no longer exists.');
        setParams(
          (p) => {
            p.delete('query');
            return p;
          },
          { replace: true },
        );
      })
      .catch((e: unknown) => {
        notify.error(toUserMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id, notify, set, setParams]);

  const loadDesign = (d: SchemaDesign) => {
    update(d);
    setSelected(d.tables[0]?.id ?? null);
  };

  return (
    <ToolWorkspace
      tool={tool}
      toolbar={
        <OptionsBar>
          <DialectSelect />
          <Button
            onClick={() => {
              setImportOpen(true);
            }}
          >
            Import CREATE TABLE…
          </Button>
          <Button
            aria-haspopup="menu"
            onClick={(e) => {
              setMenu(e.currentTarget);
            }}
          >
            Design
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
                loadDesign(designFromTables(parseTables(sampleSchema(dialect), dialect)));
              }}
            >
              Load the sample design
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenu(null);
                setOpenSaved(true);
              }}
            >
              Open saved design…
            </MenuItem>
            <MenuItem
              disabled={design.tables.length === 0}
              onClick={() => {
                setMenu(null);
                setSaveOpen(true);
              }}
            >
              Save in this browser…
            </MenuItem>
            <MenuItem
              disabled={design.tables.length === 0}
              onClick={() => {
                setMenu(null);
                void confirm({
                  title: 'Clear the design?',
                  message: 'Every table and relationship is removed.',
                  confirmLabel: 'Clear',
                  destructive: true,
                }).then((ok) => {
                  if (ok) {
                    loadDesign(emptyDesign());
                    setCurrent(null);
                  }
                });
              }}
            >
              Clear
            </MenuItem>
          </Menu>
          <DownloadButton
            content={() => `${JSON.stringify(design, null, 2)}\n`}
            filename="schema-design.json"
            mimeType="application/json"
            label="Download design (JSON)"
            disabled={design.tables.length === 0}
          />
          <UploadButton
            compact
            label="Open design file (JSON)"
            rules={JSON_FILE_RULES}
            onError={notify.error}
            onText={(text) => {
              try {
                loadDesign(parseDesign(text));
                setCurrent(null);
              } catch (e) {
                notify.error(toUserMessage(e));
              }
            }}
          />
          {current && (
            <Chip
              size="small"
              variant="outlined"
              label={current.name}
              onDelete={() => {
                setCurrent(null);
              }}
            />
          )}
        </OptionsBar>
      }
    >
      <SplitPane
        storageKey="sql.schema-designer"
        defaultRatio={0.6}
        first={
          <Panel
            title="Tables"
            meta={
              <Chip
                size="small"
                variant="outlined"
                label={`${String(design.tables.length)} tables · ${String(design.relations.length)} relationships`}
                sx={{ height: 20, fontSize: 11 }}
              />
            }
          >
            <DesignEditor
              design={design}
              onChange={update}
              selectedId={selected}
              onSelect={setSelected}
            />
          </Panel>
        }
        second={
          <Panel title="Schema" ariaLabel="Schema output">
            <Tabs
              value={tab}
              onChange={(_, v: number) => {
                setTab(v);
              }}
              sx={{ px: 1.5, minHeight: 40, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Diagram" sx={{ minHeight: 40 }} />
              <Tab label="DDL" sx={{ minHeight: 40 }} />
              <Tab label={`Problems (${String(issues.length)})`} sx={{ minHeight: 40 }} />
            </Tabs>
            {tab === 0 && (
              <Box sx={{ flex: 1, minHeight: 300 }}>
                {design.tables.length ? (
                  <SchemaDiagram design={design} />
                ) : (
                  <EmptyState
                    dense
                    title="No tables yet"
                    description="Add a table, import CREATE TABLE statements, or load the sample design."
                  />
                )}
              </Box>
            )}
            {tab === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{ alignItems: 'center', flexWrap: 'wrap', px: 1.5, py: 1 }}
                >
                  <SwitchOption
                    label="DROP existing tables"
                    checked={opts.dropExisting}
                    onChange={(dropExisting) => {
                      setOpts({ dropExisting });
                    }}
                  />
                  <SwitchOption
                    label="Quote every identifier"
                    checked={opts.quoteAll}
                    onChange={(quoteAll) => {
                      setOpts({ quoteAll });
                    }}
                  />
                  <Box sx={{ flex: 1 }} />
                  {ddl.sql && (
                    <>
                      <CopyButton label="Copy DDL" value={ddl.sql} />
                      <DownloadButton
                        content={ddl.sql}
                        filename={`schema-${dialect}.sql`}
                        mimeType="application/sql"
                        label="Download DDL"
                      />
                      {dialect === 'sqlite' && (
                        <Button
                          size="small"
                          onClick={() => {
                            set({ playground: ddl.sql });
                            void navigate('/sql/playground');
                          }}
                        >
                          Run in SQLite Playground
                        </Button>
                      )}
                      <Button
                        size="small"
                        onClick={() => {
                          set({ schema: ddl.sql });
                          void navigate('/sql/to-csharp');
                        }}
                      >
                        Generate C#
                      </Button>
                    </>
                  )}
                </Stack>
                {ddl.error ? (
                  <Alert severity="warning" role="alert" sx={{ m: 1.5 }}>
                    {ddl.error}
                  </Alert>
                ) : (
                  <>
                    {ddl.notes.map((n) => (
                      <Alert key={n} severity="info" sx={{ mx: 1.5, mb: 1, py: 0 }}>
                        {n}
                      </Alert>
                    ))}
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      <CodeEditor
                        value={ddl.sql}
                        readOnly
                        language="sql"
                        ariaLabel="Generated DDL"
                      />
                    </Box>
                  </>
                )}
              </Box>
            )}
            {tab === 2 && (
              <Box sx={{ overflow: 'auto', p: 1.5 }}>
                {issues.length === 0 ? (
                  <Alert severity="success">No problems found.</Alert>
                ) : (
                  <List dense aria-label="Design problems">
                    {issues.map((i) => (
                      <ListItem key={`${i.severity}:${i.message}`} disableGutters>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={i.severity === 'error' ? 'error' : 'warning'}
                          label={i.severity}
                          sx={{ mr: 1, minWidth: 64 }}
                        />
                        <ListItemText primary={i.message} />
                        {i.tableId && (
                          <Button
                            size="small"
                            onClick={() => {
                              setSelected(i.tableId ?? null);
                            }}
                          >
                            Show
                          </Button>
                        )}
                      </ListItem>
                    ))}
                  </List>
                )}
                {errors > 0 && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    DDL is generated once the errors are fixed.
                  </Alert>
                )}
              </Box>
            )}
          </Panel>
        }
      />
      <ImportDdlDialog
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
        }}
        onImport={(d, mode) => {
          setImportOpen(false);
          if (mode === 'replace') loadDesign(d);
          else
            update({
              version: 1,
              tables: [...design.tables, ...d.tables],
              relations: [...design.relations, ...d.relations],
            });
          notify.success(
            `Imported ${String(d.tables.length)} ${d.tables.length === 1 ? 'table' : 'tables'}.`,
          );
        }}
      />
      <OpenSavedDialog
        open={openSaved}
        title="Open saved design"
        noun="design"
        emptyHint="Use Design → Save in this browser to keep a design."
        query={savedQuery}
        onQueryChange={setSavedQuery}
        items={saved?.map((q) => ({
          ...q,
          description: `${DIALECTS[q.dialect].label} · updated ${formatDistanceToNowStrict(q.updatedAt, { addSuffix: true })}`,
        }))}
        onClose={() => {
          setOpenSaved(false);
        }}
        onOpen={(summary) => {
          setOpenSaved(false);
          savedQueriesRepository
            .get(summary.id)
            .then((q) => {
              if (!q || typeof q.content !== 'string') {
                notify.warning('That saved design no longer exists.');
                return;
              }
              loadDesign(parseDesign(q.content));
              set({ dialect: q.dialect });
              setCurrent({ id: q.id, name: q.name });
            })
            .catch((e: unknown) => {
              notify.error(toUserMessage(e));
            });
        }}
        onDelete={(q) => savedQueriesRepository.remove(q.id)}
      />
      <SaveNameDialog
        open={saveOpen}
        title="Save design"
        initialName={current?.name ?? 'My schema'}
        helperText={`${String(design.tables.length)} tables · stored only in this browser`}
        canSaveAsNew={current !== null}
        onClose={() => {
          setSaveOpen(false);
        }}
        onSave={async (name, asNew) => {
          const q = await savedQueriesRepository.save({
            ...(current && !asNew ? { id: current.id } : {}),
            name,
            dialect,
            kind: 'schema',
            content: JSON.stringify(design),
          });
          setCurrent({ id: q.id, name: q.name });
          setSaveOpen(false);
          notify.success(`Saved "${q.name}"`);
        }}
      />
    </ToolWorkspace>
  );
}
