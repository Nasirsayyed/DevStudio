import {
  Box,
  Button,
  Chip,
  Drawer,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Add, Code1, FolderOpen, Save2 } from 'iconsax-reactjs';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Panel, SplitPane, ToolWorkspace, useConfirm, useNotify } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import { useHotkey } from '@/hooks/useHotkey';
import {
  emptyRequest,
  hasLiteralCredentials,
  type RequestDraft,
  withoutCredentials,
} from '@/core/http/model';
import { apiCollectionsRepository } from '@/services/db/repositories/apiCollectionsRepository';
import { flushApiWorkspaceDraft, useApiWorkspaceStore } from '@/stores/apiWorkspaceStore';
import { requireTool } from '@/tools/toolRegistry';
import type { ApiRequestEntity } from '@/types/entities';
import { CollectionsPanel } from '../components/CollectionsPanel';
import { EnvironmentSelect } from '../components/EnvironmentSelect';
import { RequestEditor } from '../components/RequestEditor';
import {
  CodeSnippetDialog,
  CurlImportDialog,
  type SaveTarget,
  SaveRequestDialog,
} from '../components/RequestDialogs';
import { ResponseViewer } from '../components/ResponseViewer';
import { useApiDraft, useSendRequest, useVariableScopes } from '../hooks';

export default function RequestBuilderPage() {
  const tool = requireTool('api.requests');
  useApiDraft();
  const draft = useApiWorkspaceStore((s) => s.draft);
  const openRef = useApiWorkspaceStore((s) => s.open);
  const dirty = useApiWorkspaceStore((s) => s.dirty);
  const update = useApiWorkspaceStore((s) => s.update);
  const load = useApiWorkspaceStore((s) => s.load);
  const setDraft = useApiWorkspaceStore((s) => s.setDraft);
  const setState = useApiWorkspaceStore((s) => s.set);
  const { scopes, secrets } = useVariableScopes(openRef?.collectionId ?? null);
  const sender = useSendRequest();
  const resetSender = sender.reset;
  const notify = useNotify();
  const confirm = useConfirm();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const [showCollections, setShowCollections] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [saveDialog, setSaveDialog] = useState<{
    asNew: boolean;
    collectionId: string | null;
    folderId: string | null;
  } | null>(null);
  const [newTarget, setNewTarget] = useState<{
    collectionId: string;
    folderId: string | null;
  } | null>(null);
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [curlOpen, setCurlOpen] = useState(false);
  const [moreMenu, setMoreMenu] = useState<HTMLElement | null>(null);
  const [params, setParams] = useSearchParams();

  const discardOk = useCallback(
    async () =>
      !useApiWorkspaceStore.getState().dirty ||
      confirm({
        title: 'Discard unsaved changes?',
        message: 'The request open in the builder has changes that are not saved.',
        confirmLabel: 'Discard',
        destructive: true,
      }),
    [confirm],
  );

  const openRequest = useCallback(
    async (r: ApiRequestEntity) => {
      if (useApiWorkspaceStore.getState().open?.id === r.id) return;
      if (!(await discardOk())) return;
      try {
        load(apiCollectionsRepository.draftOf(r), {
          id: r.id,
          collectionId: r.collectionId,
          folderId: r.folderId,
        });
        resetSender();
        setNewTarget(null);
        setDrawer(false);
      } catch (error) {
        notify.error(toUserMessage(error));
      }
    },
    [discardOk, load, notify, resetSender],
  );

  // ?request=<id> opens a saved request (links from the command palette and history).
  const linked = params.get('request');
  useEffect(() => {
    if (!linked) return;
    apiCollectionsRepository
      .getRequest(linked)
      .then(async (r) => {
        if (r) await openRequest(r);
        else notify.warning('That saved request no longer exists.');
      })
      .catch((error: unknown) => {
        notify.error(toUserMessage(error));
      })
      .finally(() => {
        setParams(
          (p) => {
            p.delete('request');
            return p;
          },
          { replace: true },
        );
      });
  }, [linked, notify, openRequest, setParams]);

  const newRequest = async (
    target: { collectionId: string; folderId: string | null } | null = null,
  ) => {
    if (!(await discardOk())) return;
    load(emptyRequest(), null);
    sender.reset();
    setNewTarget(target);
    setDrawer(false);
  };

  const send = () => {
    if (!draft.url.trim() || sender.state.status === 'sending') return;
    void sender.send(draft, scopes, secrets, openRef?.id ?? null);
  };

  const persist = async (
    d: RequestDraft,
    target: { id?: string; collectionId: string | null; folderId: string | null },
  ) => {
    const saved = await apiCollectionsRepository.saveRequest({ ...target, draft: d });
    setDraft({ ...useApiWorkspaceStore.getState().draft, name: saved.name }, false);
    setState({
      open: { id: saved.id, collectionId: saved.collectionId, folderId: saved.folderId },
      dirty: false,
    });
    setNewTarget(null);
    await flushApiWorkspaceDraft();
    notify.success(`Saved "${saved.name}"`);
  };

  const save = (asNew = false) => {
    // Quick save keeps the request where it is; credentials always need an explicit choice.
    if (openRef && !asNew && !hasLiteralCredentials(draft.auth)) {
      persist(draft, openRef).catch((error: unknown) => {
        notify.error(toUserMessage(error));
      });
      return;
    }
    setSaveDialog({
      asNew,
      collectionId: newTarget?.collectionId ?? openRef?.collectionId ?? null,
      folderId: newTarget?.folderId ?? openRef?.folderId ?? null,
    });
  };

  const onSaveDialog = async (t: SaveTarget) => {
    const d = { ...draft, name: t.name.trim() };
    await persist(t.keepCredentials ? d : withoutCredentials(d), {
      ...(openRef && saveDialog && !saveDialog.asNew ? { id: openRef.id } : {}),
      collectionId: t.collectionId,
      folderId: t.folderId,
    });
    setSaveDialog(null);
  };

  const shortcuts = { enabled: !saveDialog && !snippetOpen && !curlOpen };
  useHotkey('mod+enter', send, shortcuts);
  useHotkey(
    'mod+s',
    () => {
      save();
    },
    shortcuts,
  );

  const collections = (
    <CollectionsPanel
      activeId={openRef?.id ?? null}
      onOpen={(r) => void openRequest(r)}
      onNewInCollection={(collectionId, folderId) => void newRequest({ collectionId, folderId })}
      onDeleted={(ids) => {
        const current = useApiWorkspaceStore.getState().open;
        if (current && ids.includes(current.id)) setState({ open: null, dirty: true });
      }}
    />
  );

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
            variant={showCollections && desktop ? 'outlined' : 'text'}
            startIcon={<FolderOpen size={16} color="currentColor" />}
            aria-pressed={desktop ? showCollections : drawer}
            onClick={() => {
              if (desktop) setShowCollections((v) => !v);
              else setDrawer(true);
            }}
          >
            Collections
          </Button>
          <Button
            startIcon={<Add size={16} color="currentColor" />}
            onClick={() => void newRequest()}
          >
            New
          </Button>
          <Button
            startIcon={<Save2 size={16} color="currentColor" />}
            onClick={() => {
              save();
            }}
          >
            Save
          </Button>
          <Button
            aria-haspopup="menu"
            onClick={(e) => {
              setMoreMenu(e.currentTarget);
            }}
          >
            More
          </Button>
          <Menu
            anchorEl={moreMenu}
            open={moreMenu !== null}
            onClose={() => {
              setMoreMenu(null);
            }}
          >
            <MenuItem
              onClick={() => {
                setMoreMenu(null);
                save(true);
              }}
            >
              Save as…
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMoreMenu(null);
                setCurlOpen(true);
              }}
            >
              Import cURL…
            </MenuItem>
            <MenuItem
              disabled={!draft.url.trim()}
              onClick={() => {
                setMoreMenu(null);
                setSnippetOpen(true);
              }}
            >
              <Code1 size={16} color="currentColor" style={{ marginRight: 8 }} />
              Code snippet…
            </MenuItem>
          </Menu>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" noWrap sx={{ maxWidth: 260 }} aria-label="Open request">
            {openRef ? draft.name || 'Untitled request' : 'Unsaved request'}
          </Typography>
          {dirty && openRef && (
            <Chip size="small" color="warning" variant="outlined" label="Modified" />
          )}
          <EnvironmentSelect />
        </Stack>
      }
    >
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, gap: 1.5, p: { xs: 1.5, sm: 2 } }}>
        {desktop && showCollections && (
          <Paper
            variant="outlined"
            sx={{ width: 260, flexShrink: 0, borderRadius: 2.5, overflow: 'hidden' }}
          >
            {collections}
          </Paper>
        )}
        {!desktop && (
          <Drawer
            open={drawer}
            onClose={() => {
              setDrawer(false);
            }}
            slotProps={{ paper: { sx: { width: 300 } } }}
          >
            {collections}
          </Drawer>
        )}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <SplitPane
            storageKey="api.requests"
            label="Resize request and response"
            stackedPaneHeight="auto"
            first={
              <Panel title="Request">
                <Box
                  sx={{ p: 1.5, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
                >
                  <RequestEditor
                    draft={draft}
                    onChange={update}
                    scopes={scopes}
                    sending={sender.state.status === 'sending'}
                    onSend={send}
                  />
                </Box>
              </Panel>
            }
            second={<ResponseViewer state={sender.state} onCancel={sender.cancel} />}
          />
        </Box>
      </Box>
      {saveDialog && (
        <SaveRequestDialog
          open
          draft={draft}
          initial={{ collectionId: saveDialog.collectionId, folderId: saveDialog.folderId }}
          onClose={() => {
            setSaveDialog(null);
          }}
          onSave={onSaveDialog}
        />
      )}
      <CodeSnippetDialog
        open={snippetOpen}
        draft={draft}
        scopes={scopes}
        onClose={() => {
          setSnippetOpen(false);
        }}
      />
      <CurlImportDialog
        open={curlOpen}
        onClose={() => {
          setCurlOpen(false);
        }}
        onImport={(d) => {
          void (async () => {
            if (!(await discardOk())) return;
            load(d, null);
            setState({ dirty: true });
            sender.reset();
            setCurlOpen(false);
            notify.success('Imported the cURL command.');
          })();
        }}
      />
    </ToolWorkspace>
  );
}
