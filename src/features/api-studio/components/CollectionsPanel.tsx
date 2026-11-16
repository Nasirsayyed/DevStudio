import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { Add, ArrowDown2, ArrowRight2, DocumentDownload, Folder2, More } from 'iconsax-reactjs';
import { useNavigate } from 'react-router';
import { type ReactNode, useState } from 'react';
import { EmptyState, SearchInput, useConfirm, useNotify } from '@/components';
import { SaveNameDialog } from '@/components/workspace/SavedItemDialogs';
import { toUserMessage } from '@/core/errors/AppError';
import { exportNative, exportPostman } from '@/core/http/collections';
import { downloadText } from '@/services/files/textFiles';
import { apiCollectionsRepository } from '@/services/db/repositories/apiCollectionsRepository';
import { fontFamilies } from '@/theme/tokens';
import type { ApiRequestEntity, CollectionEntity, CollectionFolder } from '@/types/entities';
import { ImportCollectionDialog } from './ImportCollectionDialog';

type NameAction =
  | { kind: 'new-collection' }
  | { kind: 'rename-collection'; collection: CollectionEntity }
  | { kind: 'new-folder'; collection: CollectionEntity; parentId: string | null }
  | { kind: 'rename-folder'; collection: CollectionEntity; folder: CollectionFolder };

type MenuTarget =
  | { kind: 'collection'; collection: CollectionEntity; anchor: HTMLElement }
  | { kind: 'folder'; collection: CollectionEntity; folder: CollectionFolder; anchor: HTMLElement }
  | { kind: 'request'; request: ApiRequestEntity; anchor: HTMLElement };

const METHOD_COLOR: Record<string, string> = {
  GET: 'success.main',
  POST: 'warning.main',
  PUT: 'info.main',
  PATCH: 'secondary.main',
  DELETE: 'error.main',
};

function nameTitle(a: NameAction): { title: string; initial: string } {
  switch (a.kind) {
    case 'new-collection':
      return { title: 'New collection', initial: 'My collection' };
    case 'rename-collection':
      return { title: 'Rename collection', initial: a.collection.name };
    case 'new-folder':
      return { title: 'New folder', initial: 'New folder' };
    case 'rename-folder':
      return { title: 'Rename folder', initial: a.folder.name };
  }
}

/** Collections → folders → requests, with create/rename/duplicate/delete. */
export function CollectionsPanel({
  activeId,
  onOpen,
  onNewInCollection,
  onDeleted,
}: {
  activeId: string | null;
  onOpen: (request: ApiRequestEntity) => void;
  onNewInCollection: (collectionId: string, folderId: string | null) => void;
  onDeleted: (requestIds: string[]) => void;
}) {
  const collections = useLiveQuery(() => apiCollectionsRepository.listCollections(), []);
  const requests = useLiveQuery(() => apiCollectionsRepository.listRequests(), []);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [naming, setNaming] = useState<NameAction | null>(null);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const notify = useNotify();

  const toggle = (id: string) => {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const q = query.trim().toLowerCase();
  const matches = (r: ApiRequestEntity) =>
    !q || r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q);

  const run = async (fn: () => Promise<unknown>, message?: string) => {
    try {
      await fn();
      if (message) notify.success(message);
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };

  const exportAs = async (c: CollectionEntity, format: 'devstudio' | 'postman') => {
    try {
      const bundle = await apiCollectionsRepository.exportBundle(c.id);
      const base = c.name.replace(/[^\p{L}\p{N}._-]+/gu, '-') || 'collection';
      if (format === 'postman')
        downloadText(exportPostman(bundle), `${base}.postman_collection.json`, 'application/json');
      else
        downloadText(exportNative(bundle), `${base}.devstudio-collection.json`, 'application/json');
      notify.success('Exported without credentials (variables like {{token}} are kept).');
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };

  const requestRow = (r: ApiRequestEntity, depth: number) => (
    <ListItemButton
      key={r.id}
      selected={r.id === activeId}
      onClick={() => {
        onOpen(r);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ kind: 'request', request: r, anchor: e.currentTarget });
      }}
      sx={{ pl: 1 + depth * 1.5, py: 0.25, pr: 0.5 }}
      aria-label={`${r.method} ${r.name}`}
    >
      <Typography
        component="span"
        sx={{
          width: 52,
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 700,
          fontFamily: fontFamilies.mono,
          color: METHOD_COLOR[r.method] ?? 'text.secondary',
        }}
      >
        {r.method}
      </Typography>
      <ListItemText primary={r.name} slotProps={{ primary: { noWrap: true, variant: 'body2' } }} />
      <IconButton
        size="small"
        aria-label={`Actions for ${r.name}`}
        onClick={(e) => {
          e.stopPropagation();
          setMenu({ kind: 'request', request: r, anchor: e.currentTarget });
        }}
      >
        <More size={14} color="currentColor" />
      </IconButton>
    </ListItemButton>
  );

  const folderTree = (c: CollectionEntity, parentId: string | null, depth: number): ReactNode[] => {
    const inHere = (requests ?? []).filter(
      (r) => r.collectionId === c.id && (r.folderId ?? null) === parentId && matches(r),
    );
    const folders = c.folders.filter((f) => f.parentId === parentId);
    return [
      ...folders.map((f) => {
        const open = !collapsed.has(f.id) || q !== '';
        return (
          <Box key={f.id}>
            <ListItemButton
              onClick={() => {
                toggle(f.id);
              }}
              sx={{ pl: 1 + depth * 1.5, py: 0.25, pr: 0.5 }}
              aria-expanded={open}
              aria-label={`Folder ${f.name}`}
            >
              {open ? (
                <ArrowDown2 size={12} color="currentColor" />
              ) : (
                <ArrowRight2 size={12} color="currentColor" />
              )}
              <Folder2 size={16} color="currentColor" style={{ margin: '0 6px' }} />
              <ListItemText
                primary={f.name}
                slotProps={{ primary: { noWrap: true, variant: 'body2' } }}
              />
              <IconButton
                size="small"
                aria-label={`Actions for folder ${f.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu({ kind: 'folder', collection: c, folder: f, anchor: e.currentTarget });
                }}
              >
                <More size={14} color="currentColor" />
              </IconButton>
            </ListItemButton>
            {open && folderTree(c, f.id, depth + 1)}
          </Box>
        );
      }),
      ...inHere.map((r) => requestRow(r, depth + 1)),
    ];
  };

  const loose = (requests ?? []).filter((r) => r.collectionId === null && matches(r));
  const name = naming ? nameTitle(naming) : null;

  return (
    <Box
      component="nav"
      aria-label="Collections"
      sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', p: 1.5, pb: 1 }}>
        <Typography variant="subtitle2" component="h2" sx={{ flex: 1 }}>
          Collections
        </Typography>
        <Tooltip title="Import collection">
          <IconButton
            size="small"
            aria-label="Import collection"
            onClick={() => {
              setImporting(true);
            }}
          >
            <DocumentDownload size={18} color="currentColor" />
          </IconButton>
        </Tooltip>
        <Tooltip title="New collection">
          <IconButton
            size="small"
            aria-label="New collection"
            onClick={() => {
              setNaming({ kind: 'new-collection' });
            }}
          >
            <Add size={18} color="currentColor" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box sx={{ px: 1.5, pb: 1 }}>
        <SearchInput value={query} onChange={setQuery} label="Search requests" fullWidth />
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {collections?.length === 0 && loose.length === 0 ? (
          <EmptyState
            dense
            title="No collections yet"
            description="Save a request to create one, or start an empty collection."
            action={
              <Button
                size="small"
                onClick={() => {
                  setNaming({ kind: 'new-collection' });
                }}
              >
                New collection
              </Button>
            }
          />
        ) : (
          <List dense disablePadding aria-label="Saved requests">
            {(collections ?? []).map((c) => {
              const open = !collapsed.has(c.id) || q !== '';
              return (
                <Box key={c.id}>
                  <ListItemButton
                    onClick={() => {
                      toggle(c.id);
                    }}
                    sx={{ pl: 1, py: 0.5, pr: 0.5 }}
                    aria-expanded={open}
                    aria-label={`Collection ${c.name}`}
                  >
                    {open ? (
                      <ArrowDown2 size={12} color="currentColor" />
                    ) : (
                      <ArrowRight2 size={12} color="currentColor" />
                    )}
                    <ListItemText
                      primary={c.name}
                      sx={{ ml: 0.75 }}
                      slotProps={{
                        primary: { noWrap: true, variant: 'body2', sx: { fontWeight: 600 } },
                      }}
                    />
                    <IconButton
                      size="small"
                      aria-label={`Actions for collection ${c.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu({ kind: 'collection', collection: c, anchor: e.currentTarget });
                      }}
                    >
                      <More size={14} color="currentColor" />
                    </IconButton>
                  </ListItemButton>
                  {open && folderTree(c, null, 0)}
                </Box>
              );
            })}
            {loose.map((r) => requestRow(r, 0))}
          </List>
        )}
      </Box>

      <Menu
        anchorEl={menu?.anchor ?? null}
        open={menu !== null}
        onClose={() => {
          setMenu(null);
        }}
      >
        {menu?.kind === 'collection' && [
          <MenuItem
            key="req"
            onClick={() => {
              setMenu(null);
              onNewInCollection(menu.collection.id, null);
            }}
          >
            New request here
          </MenuItem>,
          <MenuItem
            key="folder"
            onClick={() => {
              setMenu(null);
              setNaming({ kind: 'new-folder', collection: menu.collection, parentId: null });
            }}
          >
            New folder
          </MenuItem>,
          <MenuItem
            key="rename"
            onClick={() => {
              setMenu(null);
              setNaming({ kind: 'rename-collection', collection: menu.collection });
            }}
          >
            Rename
          </MenuItem>,
          <MenuItem
            key="run"
            onClick={() => {
              const id = menu.collection.id;
              setMenu(null);
              void navigate(`/api/runner?collection=${id}`);
            }}
          >
            Run collection
          </MenuItem>,
          <MenuItem
            key="export"
            onClick={() => {
              const c = menu.collection;
              setMenu(null);
              void exportAs(c, 'devstudio');
            }}
          >
            Export (DevStudio JSON)
          </MenuItem>,
          <MenuItem
            key="export-postman"
            onClick={() => {
              const c = menu.collection;
              setMenu(null);
              void exportAs(c, 'postman');
            }}
          >
            Export (Postman v2.1)
          </MenuItem>,
          <MenuItem
            key="delete"
            sx={{ color: 'error.main' }}
            onClick={() => {
              const c = menu.collection;
              setMenu(null);
              void (async () => {
                const ok = await confirm({
                  title: `Delete "${c.name}"?`,
                  message:
                    'The collection, its folders and every request in it will be deleted from this browser.',
                  confirmLabel: 'Delete',
                  destructive: true,
                });
                if (!ok) return;
                const ids = (requests ?? [])
                  .filter((r) => r.collectionId === c.id)
                  .map((r) => r.id);
                await run(
                  () => apiCollectionsRepository.removeCollection(c.id),
                  `Deleted "${c.name}"`,
                );
                onDeleted(ids);
              })();
            }}
          >
            Delete…
          </MenuItem>,
        ]}
        {menu?.kind === 'folder' && [
          <MenuItem
            key="req"
            onClick={() => {
              setMenu(null);
              onNewInCollection(menu.collection.id, menu.folder.id);
            }}
          >
            New request here
          </MenuItem>,
          <MenuItem
            key="sub"
            onClick={() => {
              setMenu(null);
              setNaming({
                kind: 'new-folder',
                collection: menu.collection,
                parentId: menu.folder.id,
              });
            }}
          >
            New subfolder
          </MenuItem>,
          <MenuItem
            key="rename"
            onClick={() => {
              setMenu(null);
              setNaming({
                kind: 'rename-folder',
                collection: menu.collection,
                folder: menu.folder,
              });
            }}
          >
            Rename
          </MenuItem>,
          <MenuItem
            key="delete"
            sx={{ color: 'error.main' }}
            onClick={() => {
              const { collection: c, folder: f } = menu;
              setMenu(null);
              void (async () => {
                const ok = await confirm({
                  title: `Delete folder "${f.name}"?`,
                  message: 'Its subfolders and requests will be deleted too.',
                  confirmLabel: 'Delete',
                  destructive: true,
                });
                if (!ok) return;
                const before = new Set(
                  (await apiCollectionsRepository.listRequests(c.id)).map((r) => r.id),
                );
                await run(
                  () => apiCollectionsRepository.removeFolder(c.id, f.id),
                  `Deleted "${f.name}"`,
                );
                const after = new Set(
                  (await apiCollectionsRepository.listRequests(c.id)).map((r) => r.id),
                );
                onDeleted([...before].filter((id) => !after.has(id)));
              })();
            }}
          >
            Delete…
          </MenuItem>,
        ]}
        {menu?.kind === 'request' && [
          <MenuItem
            key="open"
            onClick={() => {
              setMenu(null);
              onOpen(menu.request);
            }}
          >
            Open
          </MenuItem>,
          <MenuItem
            key="dup"
            onClick={() => {
              const r = menu.request;
              setMenu(null);
              void run(
                () => apiCollectionsRepository.duplicateRequest(r.id),
                `Duplicated "${r.name}"`,
              );
            }}
          >
            Duplicate
          </MenuItem>,
          <MenuItem
            key="delete"
            sx={{ color: 'error.main' }}
            onClick={() => {
              const r = menu.request;
              setMenu(null);
              void (async () => {
                const ok = await confirm({
                  title: `Delete "${r.name}"?`,
                  confirmLabel: 'Delete',
                  destructive: true,
                });
                if (!ok) return;
                await run(
                  () => apiCollectionsRepository.removeRequest(r.id),
                  `Deleted "${r.name}"`,
                );
                onDeleted([r.id]);
              })();
            }}
          >
            Delete…
          </MenuItem>,
        ]}
      </Menu>

      <ImportCollectionDialog
        open={importing}
        onClose={() => {
          setImporting(false);
        }}
      />
      <SaveNameDialog
        open={naming !== null}
        title={name?.title ?? ''}
        initialName={name?.initial ?? ''}
        helperText=""
        canSaveAsNew={false}
        onClose={() => {
          setNaming(null);
        }}
        onSave={async (value) => {
          const a = naming;
          if (!a) return;
          if (a.kind === 'new-collection')
            await apiCollectionsRepository.saveCollection({ name: value });
          else if (a.kind === 'rename-collection')
            await apiCollectionsRepository.saveCollection({ id: a.collection.id, name: value });
          else if (a.kind === 'new-folder')
            await apiCollectionsRepository.addFolder(a.collection.id, value, a.parentId);
          else await apiCollectionsRepository.renameFolder(a.collection.id, a.folder.id, value);
          setNaming(null);
        }}
      />
    </Box>
  );
}
