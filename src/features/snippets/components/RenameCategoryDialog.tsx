import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { SNIPPET_LIMITS } from '@/core/snippets/model';

export function RenameCategoryDialog({
  name,
  onClose,
  onRename,
}: {
  /** Category to rename; null closes the dialog. */
  name: string | null;
  onClose: () => void;
  onRename: (from: string, to: string) => void;
}) {
  return (
    <Dialog
      open={name !== null}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="rename-category-title"
    >
      {name !== null && <RenameForm key={name} name={name} onClose={onClose} onRename={onRename} />}
    </Dialog>
  );
}

function RenameForm({
  name,
  onClose,
  onRename,
}: {
  name: string;
  onClose: () => void;
  onRename: (from: string, to: string) => void;
}) {
  const [value, setValue] = useState(name);
  const trimmed = value.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && trimmed !== name) onRename(name, trimmed);
      }}
    >
      <DialogTitle id="rename-category-title">Rename category</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Category name"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          slotProps={{ htmlInput: { maxLength: SNIPPET_LIMITS.category } }}
          helperText="Every snippet in this category moves to the new name."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={!trimmed || trimmed === name}>
          Rename
        </Button>
      </DialogActions>
    </form>
  );
}
