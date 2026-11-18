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
import { Code1, Trash } from 'iconsax-reactjs';
import { useState } from 'react';
import { EmptyState, SearchInput, useConfirm, useNotify } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';

export interface SavedItem {
  id: string;
  name: string;
  /** Secondary line, e.g. "12 KB · updated 3 minutes ago". */
  description: string;
}

/** Searchable list of saved items (documents, queries…) with open and delete. */
export function OpenSavedDialog<T extends SavedItem>({
  open,
  title,
  noun,
  emptyHint,
  query,
  onQueryChange,
  items,
  onClose,
  onOpen,
  onDelete,
}: {
  open: boolean;
  title: string;
  /** "document", "query"… */
  noun: string;
  emptyHint: string;
  query: string;
  onQueryChange: (q: string) => void;
  items: readonly T[] | undefined;
  onClose: () => void;
  onOpen: (item: T) => void;
  onDelete: (item: T) => Promise<void>;
}) {
  const confirm = useConfirm();
  const notify = useNotify();
  const remove = async (item: T) => {
    const ok = await confirm({
      title: `Delete "${item.name}"?`,
      message: `This saved ${noun} will be permanently removed from this browser.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await onDelete(item);
      notify.success(`Deleted "${item.name}"`);
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="open-saved-title"
    >
      <DialogTitle id="open-saved-title">{title}</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 320 }}>
        <SearchInput value={query} onChange={onQueryChange} label={`Search ${noun}s`} fullWidth />
        {items && items.length === 0 ? (
          <EmptyState
            dense
            icon={Code1}
            title={query ? `No matching ${noun}s` : `No saved ${noun}s yet`}
            description={emptyHint}
          />
        ) : (
          <List dense aria-label={`Saved ${noun}s`}>
            {items?.map((item) => (
              <ListItem
                key={item.id}
                disablePadding
                secondaryAction={
                  <Tooltip title="Delete">
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => void remove(item)}
                    >
                      <Trash size={16} color="currentColor" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemButton
                  onClick={() => {
                    onOpen(item);
                  }}
                >
                  <ListItemText primary={item.name} secondary={item.description} />
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

/** Asks for a name and saves (or saves as new when an item is already open). */
export function SaveNameDialog({
  open,
  title,
  initialName,
  helperText,
  canSaveAsNew,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initialName: string;
  helperText: string;
  canSaveAsNew: boolean;
  onClose: () => void;
  /** Resolves when saved; errors are shown as a notification. */
  onSave: (name: string, asNew: boolean) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setName(initialName);
  }
  const save = async (asNew: boolean) => {
    setSaving(true);
    try {
      await onSave(name, asNew);
    } catch (error) {
      notify.error(toUserMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="save-name-title">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <DialogTitle id="save-name-title">{title}</DialogTitle>
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
            helperText={helperText}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          {canSaveAsNew && (
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
