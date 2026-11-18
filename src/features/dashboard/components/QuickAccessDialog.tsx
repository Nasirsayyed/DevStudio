import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { SearchInput } from '@/components';
import { DEFAULT_QUICK_ACCESS, MAX_QUICK_ACCESS } from '@/hooks/useQuickAccess';
import { getTool, getToolModule } from '@/tools/toolRegistry';
import { searchTools } from '@/tools/toolSearch';

export interface QuickAccessDialogProps {
  open: boolean;
  initial: readonly string[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
}

/** Lets users choose and order up to 9 quick-access tools (Alt+1…9). */
export function QuickAccessDialog({ open, initial, onClose, onSave }: QuickAccessDialogProps) {
  const [selected, setSelected] = useState<string[]>([...initial]);
  const [query, setQuery] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelected([...initial]);
      setQuery('');
    }
  }

  const tools = useMemo(() => searchTools(query), [query]);
  const full = selected.length >= MAX_QUICK_ACCESS;

  const toggle = (id: string) => {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_QUICK_ACCESS ? s : [...s, id],
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="quick-access-title"
    >
      <DialogTitle id="quick-access-title">Customize quick access</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Choose up to {MAX_QUICK_ACCESS} tools. Order follows selection, and each slot gets a
          shortcut (Alt+1 … Alt+9).
        </Typography>
        <Stack
          direction="row"
          useFlexGap
          spacing={1}
          sx={{ flexWrap: 'wrap', mb: 2, minHeight: 32 }}
          aria-label="Selected tools"
        >
          {selected.map((id, i) => (
            <Chip
              key={id}
              label={`${i + 1}. ${getTool(id)?.title ?? id}`}
              onDelete={() => {
                toggle(id);
              }}
              size="small"
              color="primary"
              variant="outlined"
            />
          ))}
          {selected.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              No tools selected.
            </Typography>
          )}
        </Stack>
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Filter tools"
          debounceMs={0}
          fullWidth
        />
        <List dense sx={{ maxHeight: 340, overflowY: 'auto', mt: 1 }}>
          {tools.map((tool) => {
            const checked = selected.includes(tool.id);
            const labelId = `qa-${tool.id}`;
            return (
              <ListItem key={tool.id} disablePadding>
                <ListItemButton
                  onClick={() => {
                    toggle(tool.id);
                  }}
                  disabled={!checked && full}
                  dense
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      edge="start"
                      checked={checked}
                      tabIndex={-1}
                      disableRipple
                      slotProps={{ input: { 'aria-labelledby': labelId } }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    id={labelId}
                    primary={tool.title}
                    secondary={getToolModule(tool).title}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3 }}>
        <Button
          color="inherit"
          onClick={() => {
            setSelected([...DEFAULT_QUICK_ACCESS]);
          }}
          sx={{ mr: 'auto' }}
        >
          Reset to defaults
        </Button>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            onSave(selected);
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
