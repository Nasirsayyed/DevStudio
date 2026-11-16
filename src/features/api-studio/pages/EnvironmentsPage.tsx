import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, Trash } from 'iconsax-reactjs';
import { useState } from 'react';
import { EmptyState, LoadingState, ToolWorkspace, useConfirm, useNotify } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import { rowId } from '@/core/http/model';
import { environmentsRepository } from '@/services/db/repositories/environmentsRepository';
import { requireTool } from '@/tools/toolRegistry';
import type { EnvironmentEntity, EnvironmentVariable } from '@/types/entities';
import { KeyValueEditor } from '../components/KeyValueEditor';
import { useActiveEnvironment } from '../hooks';

const newVariable = (): EnvironmentVariable => ({
  id: rowId(),
  key: '',
  value: '',
  enabled: true,
  secret: false,
});

interface EditState {
  name: string;
  variables: EnvironmentVariable[];
  persistSecrets: boolean;
}

const stateOf = (e: EnvironmentEntity): EditState => ({
  name: e.name,
  variables: e.variables,
  persistSecrets: e.persistSecrets,
});

function EnvironmentEditor({
  env,
  isActive,
  onActivate,
  onDeleted,
}: {
  env: EnvironmentEntity;
  isActive: boolean;
  onActivate: () => void;
  onDeleted: () => void;
}) {
  const [edit, setEdit] = useState<EditState>(() => stateOf(env));
  const [dirty, setDirty] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const confirm = useConfirm();
  const change = (patch: Partial<EditState>) => {
    setEdit((e) => ({ ...e, ...patch }));
    setDirty(true);
  };
  const secrets = edit.variables.filter((v) => v.secret).length;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await environmentsRepository.save({ id: env.id, ...edit });
      setEdit(stateOf(saved));
      setDirty(false);
      notify.success(`Saved "${saved.name}"`);
    } catch (error) {
      notify.error(toUserMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      component="form"
      aria-label={`Environment ${env.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 2,
        minHeight: 0,
        overflow: 'auto',
      }}
    >
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Name"
          value={edit.name}
          disabled={env.isBuiltIn}
          onChange={(e) => {
            change({ name: e.target.value });
          }}
          helperText={env.isBuiltIn ? 'Built-in environments keep their name.' : undefined}
          sx={{ width: 260 }}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
        <Box sx={{ flex: 1 }} />
        {isActive ? (
          <Chip color="primary" label="Active" />
        ) : (
          <Button onClick={onActivate}>Use this environment</Button>
        )}
        {!env.isBuiltIn && (
          <Tooltip title="Delete environment">
            <IconButton
              aria-label="Delete environment"
              color="error"
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: `Delete "${env.name}"?`,
                    message: 'Its variables will be removed from this browser.',
                    confirmLabel: 'Delete',
                    destructive: true,
                  });
                  if (!ok) return;
                  try {
                    await environmentsRepository.remove(env.id);
                    notify.success(`Deleted "${env.name}"`);
                    onDeleted();
                  } catch (error) {
                    notify.error(toUserMessage(error));
                  }
                })();
              }}
            >
              <Trash size={18} color="currentColor" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
          Variables
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Use them as <code>{'{{name}}'}</code> in URLs, parameters, headers, bodies and auth. Mark
          tokens and passwords as secret with the lock.
        </Typography>
        <KeyValueEditor
          label="Variables"
          keyLabel="Variable"
          rows={edit.variables}
          secrets
          make={newVariable}
          onChange={(variables) => {
            change({ variables });
          }}
        />
      </Box>
      <Alert severity={edit.persistSecrets ? 'warning' : 'info'}>
        {edit.persistSecrets
          ? 'Secret values are stored unencrypted in this browser.'
          : `Secret values (${String(secrets)}) are kept in memory only: they work until you close or reload the tab, and are never written to storage, history or exports.`}
        <FormControlLabel
          sx={{ display: 'flex', mt: 0.5 }}
          control={
            <Switch
              size="small"
              checked={edit.persistSecrets}
              onChange={(e) => {
                if (e.target.checked) setConsent(true);
                else change({ persistSecrets: false });
              }}
            />
          }
          label="Remember secret values on this device"
        />
      </Alert>
      <Stack direction="row" spacing={1}>
        <Button type="submit" variant="contained" disabled={!dirty || saving}>
          Save
        </Button>
        <Button
          disabled={!dirty || saving}
          onClick={() => {
            setEdit(stateOf(env));
            setDirty(false);
          }}
        >
          Revert
        </Button>
      </Stack>
      <Dialog
        open={consent}
        onClose={() => {
          setConsent(false);
        }}
        aria-labelledby="persist-secrets-title"
      >
        <DialogTitle id="persist-secrets-title">Store secret values?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The values of secret variables in “{edit.name}” will be saved in this browser&apos;s
            IndexedDB in plain text. Anyone with access to this browser profile, and any script
            running on this site, could read them. Only do this on a device you trust, and prefer
            short-lived tokens.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setConsent(false);
            }}
          >
            Cancel
          </Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => {
              change({ persistSecrets: true });
              setConsent(false);
            }}
          >
            Store in plain text
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function EnvironmentsPage() {
  const tool = requireTool('api.environments');
  const { environments, active, setActive } = useActiveEnvironment();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const notify = useNotify();
  const selected =
    environments?.find((e) => e.id === selectedId) ?? active ?? environments?.[0] ?? null;

  const add = async () => {
    const taken = new Set(environments?.map((e) => e.name));
    let n = 1;
    while (taken.has(`Custom ${String(n)}`)) n++;
    try {
      const env = await environmentsRepository.save({
        name: `Custom ${String(n)}`,
        variables: [],
        persistSecrets: false,
      });
      setSelectedId(env.id);
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };

  return (
    <ToolWorkspace tool={tool}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          p: { xs: 1.5, sm: 2 },
          flex: 1,
          minHeight: 0,
        }}
      >
        <Paper
          variant="outlined"
          sx={{ width: { md: 240 }, flexShrink: 0, borderRadius: 2.5, overflow: 'auto' }}
        >
          <Stack direction="row" sx={{ alignItems: 'center', px: 1.5, py: 1 }}>
            <Typography variant="subtitle2" component="h2" sx={{ flex: 1 }}>
              Environments
            </Typography>
            <Tooltip title="New environment">
              <IconButton size="small" aria-label="New environment" onClick={() => void add()}>
                <Add size={18} color="currentColor" />
              </IconButton>
            </Tooltip>
          </Stack>
          {environments === undefined ? (
            <LoadingState />
          ) : (
            <List dense aria-label="Environments">
              {environments.map((e) => (
                <li key={e.id}>
                  <ListItemButton
                    selected={e.id === selected?.id}
                    onClick={() => {
                      setSelectedId(e.id);
                    }}
                  >
                    <ListItemText
                      primary={e.name}
                      secondary={`${String(e.variables.filter((v) => v.key).length)} variables${e.id === active?.id ? ' · active' : ''}`}
                    />
                  </ListItemButton>
                </li>
              ))}
            </List>
          )}
        </Paper>
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            minWidth: 0,
            borderRadius: 2.5,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {selected ? (
            <EnvironmentEditor
              key={selected.id}
              env={selected}
              isActive={selected.id === active?.id}
              onActivate={() => {
                setActive(selected.id);
              }}
              onDeleted={() => {
                if (selected.id === active?.id) setActive(null);
                setSelectedId(null);
              }}
            />
          ) : (
            environments !== undefined && (
              <EmptyState
                dense
                title="No environment selected"
                description="Create an environment to define variables."
              />
            )
          )}
        </Paper>
      </Box>
    </ToolWorkspace>
  );
}
