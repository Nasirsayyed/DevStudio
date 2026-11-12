import {
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Add, ArrowLeft, DocumentDownload, DocumentUpload, Filter } from 'iconsax-reactjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useSearchParams } from 'react-router';
import { EmptyState, LoadingState, SearchInput, useConfirm, useNotify } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import { exportSnippets, exportVscodeSnippets } from '@/core/snippets/exchange';
import { emptySnippet, type SnippetDraft } from '@/core/snippets/model';
import {
  EMPTY_FILTER,
  filterSnippets,
  type SnippetFilter,
  type SnippetSort,
  snippetFacets,
} from '@/core/snippets/search';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { snippetsRepository } from '@/services/db/repositories/snippetsRepository';
import { downloadText } from '@/services/files/textFiles';
import { layout } from '@/theme/tokens';
import { ImportDialog } from '../components/ImportDialog';
import { RenameCategoryDialog } from '../components/RenameCategoryDialog';
import { SnippetEditor } from '../components/SnippetEditor';
import { SnippetFilters } from '../components/SnippetFilters';
import { SnippetList } from '../components/SnippetList';
import { toDraft } from '../draft';
import { useSnippets } from '../hooks';

const SORTS: { value: SnippetSort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Recently created' },
  { value: 'title', label: 'Title' },
  { value: 'language', label: 'Language' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function SnippetsPage() {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });
  const desktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const snippets = useSnippets();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('snippet');
  const isNew = params.get('new') === '1';
  const [opts, setOpts] = usePersistentOptions<{ sort: SnippetSort }>('snippets.list', {
    sort: 'updated',
  });
  const [filter, setFilter] = useState<Omit<SnippetFilter, 'sort'>>(EMPTY_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportMenu, setExportMenu] = useState<HTMLElement | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const notify = useNotify();
  const confirm = useConfirm();

  // Unsaved-changes protection (switching snippets, leaving the page, closing the tab).
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const allowNavigation = useRef(false);
  const onDirtyChange = useCallback((d: boolean) => {
    dirtyRef.current = d;
    setDirty(d);
  }, []);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current &&
      !allowNavigation.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void confirm({
      title: 'Discard unsaved changes?',
      message: 'The snippet you are editing has changes that are not saved.',
      confirmLabel: 'Discard',
      destructive: true,
    }).then((ok) => {
      if (ok) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker, confirm]);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty]);

  /** Navigates within the page after the user agreed to drop unsaved changes. */
  const go = useCallback(
    async (next: Record<string, string>, { force = false, replace = false } = {}) => {
      if (!force && dirtyRef.current) {
        const ok = await confirm({
          title: 'Discard unsaved changes?',
          message: 'The snippet you are editing has changes that are not saved.',
          confirmLabel: 'Discard',
          destructive: true,
        });
        if (!ok) return;
      }
      allowNavigation.current = true;
      dirtyRef.current = false;
      setDirty(false);
      setParams(next, { replace });
      // Re-arm the blocker after this navigation has been processed.
      setTimeout(() => {
        allowNavigation.current = false;
      }, 0);
    },
    [confirm, setParams],
  );

  const facets = useMemo(() => snippetFacets(snippets ?? []), [snippets]);
  const shown = useMemo(
    () => filterSnippets(snippets ?? [], { ...filter, sort: opts.sort }),
    [snippets, filter, opts.sort],
  );
  const selected = snippets?.find((s) => s.id === selectedId) ?? null;
  const categories = facets.categories.map((c) => c.name);
  const allTags = facets.tags.map((t) => t.name);
  const filtered =
    filter.query.trim() !== '' ||
    filter.favoritesOnly ||
    filter.category !== null ||
    filter.language !== null ||
    filter.tag !== null;

  const save = async (draft: SnippetDraft): Promise<boolean> => {
    try {
      const saved = await snippetsRepository.save({
        ...draft,
        ...(selected ? { id: selected.id } : {}),
      });
      if (!selected) {
        notify.success(`Saved “${saved.title}”.`);
        await go({ snippet: saved.id }, { force: true, replace: true });
      } else notify.success('Changes saved.');
      return true;
    } catch (error) {
      notify.error(toUserMessage(error, 'Could not save the snippet.'));
      return false;
    }
  };

  const remove = async () => {
    if (!selected) return;
    const copy = selected;
    try {
      await snippetsRepository.remove(copy.id);
      await go({}, { force: true, replace: true });
      notify.notify(`Deleted “${copy.title}”.`, {
        severity: 'info',
        durationMs: 8000,
        action: {
          label: 'Undo',
          onClick: () => {
            void snippetsRepository
              .restore([copy])
              .then(() => go({ snippet: copy.id }, { force: true }));
          },
        },
      });
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };

  const run = (action: () => Promise<unknown>) => {
    action().catch((error: unknown) => {
      notify.error(toUserMessage(error));
    });
  };

  const exportFile = (kind: 'all' | 'shown' | 'vscode') => {
    setExportMenu(null);
    const list = kind === 'shown' ? shown : (snippets ?? []);
    if (kind === 'vscode')
      downloadText(
        exportVscodeSnippets(list),
        `devstudio-${today()}.code-snippets`,
        'application/json',
      );
    else
      downloadText(exportSnippets(list), `devstudio-snippets-${today()}.json`, 'application/json');
    notify.success(
      `Exported ${list.length.toLocaleString()} ${list.length === 1 ? 'snippet' : 'snippets'}.`,
    );
  };

  const filters = (
    <SnippetFilters
      facets={facets}
      filter={{ ...filter, sort: opts.sort }}
      onChange={(patch) => {
        setFilter((f) => ({ ...f, ...patch }));
        setFiltersOpen(false);
      }}
      onRenameCategory={setRenaming}
      onDeleteCategory={(name) => {
        const count = facets.categories.find((c) => c.name === name)?.count ?? 0;
        void confirm({
          title: `Delete the category “${name}”?`,
          message: `${String(count)} ${count === 1 ? 'snippet moves' : 'snippets move'} to “General”. No snippet is deleted.`,
          confirmLabel: 'Delete category',
          destructive: true,
        }).then((ok) => {
          if (!ok) return;
          run(async () => {
            await snippetsRepository.deleteCategory(name);
            if (filter.category === name) setFilter((f) => ({ ...f, category: null }));
          });
        });
      }}
    />
  );

  const editorOpen = isNew || selectedId !== null;
  const editor = isNew ? (
    <SnippetEditor
      key="new"
      snippet={null}
      initial={emptySnippet(filter.language ?? 'typescript', filter.category ?? 'General')}
      categories={categories}
      tags={allTags}
      onSave={save}
      onDirtyChange={onDirtyChange}
      onToggleFavorite={() => undefined}
      onDuplicate={() => undefined}
      onDelete={() => undefined}
      onCopied={() => undefined}
    />
  ) : selected ? (
    <SnippetEditor
      key={selected.id}
      snippet={selected}
      initial={toDraft(selected)}
      categories={categories}
      tags={allTags}
      onSave={save}
      onDirtyChange={onDirtyChange}
      onToggleFavorite={() => {
        run(() => snippetsRepository.toggleFavorite(selected.id));
      }}
      onDuplicate={() => {
        run(async () => {
          const copy = await snippetsRepository.duplicate(selected.id);
          await go({ snippet: copy.id });
          notify.success('Duplicated.');
        });
      }}
      onDelete={() => void remove()}
      onCopied={() => undefined}
    />
  ) : snippets && selectedId ? (
    <EmptyState
      title="Snippet not found"
      description="It may have been deleted."
      action={<Button onClick={() => void go({})}>Back to the library</Button>}
    />
  ) : (
    <EmptyState
      title={snippets?.length ? 'Select a snippet' : 'Your snippet library is empty'}
      description={
        snippets?.length
          ? 'Choose a snippet on the left, or create a new one.'
          : 'Save reusable code with a title, language, category and tags. Everything stays in this browser.'
      }
      action={
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<Add size={16} color="currentColor" />}
            onClick={() => void go({ new: '1' })}
          >
            New snippet
          </Button>
          {!snippets?.length && (
            <Button
              startIcon={<DocumentUpload size={16} color="currentColor" />}
              onClick={() => {
                setImportOpen(true);
              }}
            >
              Import
            </Button>
          )}
        </Stack>
      }
    />
  );

  const listPane = (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Stack spacing={1} sx={{ p: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {!wide && (
            <IconButton
              aria-label="Filters"
              onClick={() => {
                setFiltersOpen(true);
              }}
            >
              <Filter size={18} color="currentColor" />
            </IconButton>
          )}
          <Box sx={{ flex: 1 }}>
            <SearchInput
              value={filter.query}
              onChange={(query) => {
                setFilter((f) => ({ ...f, query }));
              }}
              label="Search snippets"
              placeholder="Title, tag, code…"
              fullWidth
            />
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }} aria-live="polite">
            {snippets
              ? `${shown.length.toLocaleString()} of ${snippets.length.toLocaleString()}`
              : ''}
          </Typography>
          {filtered && (
            <Chip
              size="small"
              label="Clear filters"
              onDelete={() => {
                setFilter(EMPTY_FILTER);
              }}
              onClick={() => {
                setFilter(EMPTY_FILTER);
              }}
            />
          )}
          <TextField
            select
            size="small"
            label="Sort"
            value={opts.sort}
            onChange={(e) => {
              setOpts({ sort: e.target.value as SnippetSort });
            }}
            sx={{ width: 160 }}
          >
            {SORTS.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>
      {snippets === undefined ? (
        <LoadingState />
      ) : snippets.length === 0 ? (
        <EmptyState
          dense
          title="No snippets yet"
          description="Create a snippet or import a DevStudio or VS Code snippets file."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          dense
          title="No matching snippets"
          description="Try another search or clear the filters."
        />
      ) : (
        <SnippetList
          snippets={shown}
          selectedId={selectedId}
          onSelect={(id) => void go({ snippet: id })}
        />
      )}
    </Box>
  );

  const pane = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
    borderRight: 1,
    borderColor: 'divider',
  } as const;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: desktop ? `calc(100dvh - ${String(layout.topBarHeight)}px)` : 'auto',
        minHeight: desktop ? 0 : `calc(100dvh - ${String(layout.topBarHeight)}px)`,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{
          alignItems: 'center',
          flexWrap: 'wrap',
          px: { xs: 2, sm: 2.5 },
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {!desktop && editorOpen && (
          <IconButton aria-label="Back to the list" onClick={() => void go({})}>
            <ArrowLeft size={18} color="currentColor" />
          </IconButton>
        )}
        <Box sx={{ flex: 1, minWidth: 0, flexBasis: { xs: editorOpen ? 0 : '100%', sm: 0 } }}>
          <Typography variant="h5" component="h1" noWrap>
            Snippet Manager
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            Save, tag, search and reuse code. Stored only in this browser.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add size={16} color="currentColor" />}
          onClick={() => void go({ new: '1' })}
        >
          New snippet
        </Button>
        <Button
          startIcon={<DocumentUpload size={16} color="currentColor" />}
          onClick={() => {
            setImportOpen(true);
          }}
        >
          Import
        </Button>
        <Button
          startIcon={<DocumentDownload size={16} color="currentColor" />}
          disabled={!snippets?.length}
          aria-haspopup="menu"
          onClick={(e) => {
            setExportMenu(e.currentTarget);
          }}
        >
          Export
        </Button>
        <Menu
          anchorEl={exportMenu}
          open={exportMenu !== null}
          onClose={() => {
            setExportMenu(null);
          }}
        >
          <MenuItem
            onClick={() => {
              exportFile('all');
            }}
          >
            All snippets ({String(snippets?.length ?? 0)}) as JSON
          </MenuItem>
          {filtered && (
            <MenuItem
              onClick={() => {
                exportFile('shown');
              }}
            >
              Shown snippets ({String(shown.length)}) as JSON
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              exportFile('vscode');
            }}
          >
            All as VS Code snippets
          </MenuItem>
        </Menu>
      </Stack>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: wide
            ? '240px 360px minmax(0, 1fr)'
            : desktop
              ? '340px minmax(0, 1fr)'
              : '1fr',
        }}
      >
        {wide && <Box sx={pane}>{filters}</Box>}
        {(desktop || !editorOpen) && (
          <Box sx={{ ...pane, minHeight: desktop ? 0 : 480 }}>{listPane}</Box>
        )}
        {(desktop || editorOpen) && (
          <Box
            component="section"
            aria-label="Snippet"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: desktop ? 0 : 640,
              minWidth: 0,
            }}
          >
            {editor}
          </Box>
        )}
      </Box>

      <Drawer
        open={!wide && filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
        }}
        slotProps={{ paper: { sx: { width: 280 } } }}
      >
        {filters}
      </Drawer>
      <ImportDialog
        open={importOpen}
        existing={snippets ?? []}
        onClose={() => {
          setImportOpen(false);
        }}
        onImport={async (plan) => {
          const result = await snippetsRepository.applyImport(plan);
          const parts = [`${String(result.added)} added`];
          if (result.updated) parts.push(`${String(result.updated)} replaced`);
          if (result.skipped) parts.push(`${String(result.skipped)} skipped`);
          notify.success(`Import finished: ${parts.join(', ')}.`);
          return result;
        }}
      />
      <RenameCategoryDialog
        name={renaming}
        onClose={() => {
          setRenaming(null);
        }}
        onRename={(from, to) => {
          setRenaming(null);
          run(async () => {
            const n = await snippetsRepository.renameCategory(from, to);
            if (filter.category === from) setFilter((f) => ({ ...f, category: to }));
            notify.success(
              `Renamed “${from}” to “${to}” (${String(n)} ${n === 1 ? 'snippet' : 'snippets'}).`,
            );
          });
        }}
      />
    </Box>
  );
}
