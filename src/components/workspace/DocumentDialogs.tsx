import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
} from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import { Code1, Trash } from 'iconsax-reactjs';
import { useState } from 'react';
import { EmptyState, SearchInput, useConfirm, useNotify } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import { formatBytes } from '@/core/format/bytes';
import {
  removeJsonDocument,
  saveJsonDocument,
  useJsonDocumentList,
} from '@/hooks/useJsonDocuments';
import type { JsonDocumentEntity } from '@/types/entities';
import type { OpenDocument } from '@/stores/jsonWorkspaceStore';

export function OpenDocumentDialog({
  open,
  onClose,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: (doc: JsonDocumentEntity) => void;
}) {
  const [query, setQuery] = useState('');
  const docs = useJsonDocumentList(open, query);
  const confirm = useConfirm();
  const notify = useNotify();

  const remove = async (doc: JsonDocumentEntity) => {
    const ok = await confirm({
      title: `Delete "${doc.name}"?`,
      message: 'This saved document will be permanently removed from this browser.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await removeJsonDocument(doc.id);
      notify.success(`Deleted "${doc.name}"`);
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="open-doc-title">
      <DialogTitle id="open-doc-title">Open saved document</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 320 }}>
        <SearchInput value={query} onChange={setQuery} label="Search documents" fullWidth />
        {docs && docs.length === 0 ? (
          <EmptyState
            dense
            icon={Code1}
            title={query ? 'No matching documents' : 'No saved documents yet'}
            description="Use “Save” in any JSON tool to keep a document in this browser."
          />
        ) : (
          <List dense aria-label="Saved documents">
            {docs?.map((doc) => (
              <ListItem
                key={doc.id}
                disablePadding
                secondaryAction={
                  <Tooltip title="Delete">
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={`Delete ${doc.name}`}
                      onClick={() => void remove(doc)}
                    >
                      <Trash size={16} color="currentColor" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemButton
                  onClick={() => {
                    onOpen(doc);
                  }}
                >
                  <ListItemText
                    primary={doc.name}
                    secondary={`${formatBytes(doc.sizeBytes)} · updated ${formatDistanceToNowStrict(doc.updatedAt, { addSuffix: true })}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function SaveDocumentDialog({
  open,
  current,
  content,
  onClose,
  onSaved,
}: {
  open: boolean;
  current: OpenDocument | null;
  content: string;
  onClose: () => void;
  onSaved: (doc: OpenDocument) => void;
}) {
  const [name, setName] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setName(current?.name ?? `Untitled ${new Date().toLocaleString()}`);
  }

  const save = async (asNew: boolean) => {
    setSaving(true);
    try {
      const doc = await saveJsonDocument({
        ...(current && !asNew ? { id: current.id } : {}),
        name,
        content,
      });
      notify.success(`Saved "${doc.name}"`);
      onSaved({ id: doc.id, name: doc.name });
    } catch (error) {
      notify.error(toUserMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="save-doc-title">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <DialogTitle id="save-doc-title">
          {current ? 'Save document' : 'Save as document'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            helperText={`${formatBytes(content.length)} · stored only in this browser`}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          {current && (
            <Button onClick={() => void save(true)} disabled={saving || !name.trim()}>
              Save as new
            </Button>
          )}
          <Button type="submit" variant="contained" disabled={saving || !name.trim()}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
