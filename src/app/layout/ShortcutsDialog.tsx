import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import { CloseCircle } from 'iconsax-reactjs';
import { Kbd } from '@/components';
import { useUiStore } from '@/stores/uiStore';
import { SHORTCUT_LIST, type ShortcutDefinition } from '../shortcuts';

const GROUPS: ShortcutDefinition['group'][] = ['General', 'Navigation', 'Command palette'];

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsDialogOpen);
  const setOpen = useUiStore((s) => s.setShortcutsDialogOpen);
  const close = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth aria-labelledby="shortcuts-title">
      <DialogTitle id="shortcuts-title" sx={{ pr: 6 }}>
        Keyboard shortcuts
        <IconButton
          aria-label="Close"
          onClick={close}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseCircle size={20} color="currentColor" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          {GROUPS.map((group) => (
            <div key={group}>
              <Typography variant="overline" color="text.secondary">
                {group}
              </Typography>
              <Table size="small" aria-label={`${group} shortcuts`}>
                <TableBody>
                  {SHORTCUT_LIST.filter((s) => s.group === group).map((s) => (
                    <TableRow key={s.id} sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ pl: 0 }}>{s.description}</TableCell>
                      <TableCell align="right" sx={{ pr: 0, width: 140 }}>
                        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                          <Kbd combo={s.combo} />
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
