import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { SectionCard, useConfirm, useNotify } from '@/components';
import { UploadButton } from '@/components/inputs/FileDropZone';
import {
  BACKUP_TABLES,
  type BackupSection as Section,
  type BackupTable,
  createBackup,
  type ParsedBackup,
  parseBackup,
  SECTION_LABELS,
} from '@/core/backup/backup';
import { toUserMessage } from '@/core/errors/AppError';
import { BACKUP_FILE_RULES } from '@/core/files/fileValidation';
import {
  clearAllData,
  readBackupData,
  type RestoreMode,
  restoreBackup,
  tableCounts,
} from '@/services/backup/backupService';
import { CURRENT_SCHEMA_VERSION } from '@/services/db/database';
import { downloadText } from '@/services/files/textFiles';
import { DEFAULT_PREFERENCES, parsePreferences } from '@/services/preferences/preferences';
import { usePreferencesStore } from '@/stores/preferencesStore';

const TABLE_LABELS: Record<BackupTable, string> = {
  collections: 'API collections',
  apiRequests: 'Saved API requests',
  environments: 'Environments',
  jsonDocuments: 'JSON documents',
  savedQueries: 'SQL queries, designs and databases',
  codeSnippets: 'Snippets',
  favorites: 'Favorites',
  toolHistory: 'Tool history',
  apiHistory: 'API request history',
  settings: 'Settings and drafts',
  toolUsage: 'Tool usage statistics',
};

const SECTIONS: readonly Section[] = ['work', 'history', 'settings'];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Data counts, full backup (download), restore (merge or replace) and delete-all. */
export function BackupSection() {
  const notify = useNotify();
  const confirm = useConfirm();
  const counts = useLiveQuery(() => tableCounts(), []);
  const [sections, setSections] = useState<ReadonlySet<Section>>(new Set(SECTIONS));
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [restored, setRestored] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    try {
      const chosen = SECTIONS.filter((s) => sections.has(s));
      const text = createBackup(await readBackupData(chosen), {
        sections: chosen,
        includeSecrets,
        appVersion: __APP_VERSION__,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      });
      downloadText(text, `devstudio-backup-${today()}.json`, 'application/json');
      notify.success(
        includeSecrets
          ? 'Backup downloaded. It contains credentials: keep it private.'
          : 'Backup downloaded.',
      );
    } catch (error) {
      notify.error(toUserMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!pending) return;
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Replace your data?',
        message:
          'Every table included in the backup is cleared in this browser before the backup is restored. This cannot be undone.',
        confirmLabel: 'Replace',
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const written = await restoreBackup(pending.data, mode);
      const prefs =
        pending.data.preferences === null ? null : parsePreferences(pending.data.preferences);
      if (prefs) usePreferencesStore.setState(prefs);
      const total = Object.values(written).reduce((a, b) => a + b, 0);
      setPending(null);
      setRestored(`Restored ${String(total)} item(s)${prefs ? ' and your preferences' : ''}.`);
    } catch (error) {
      notify.error(toUserMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    const ok = await confirm({
      title: 'Delete all data?',
      message:
        'Every saved item, all history, settings, drafts and preferences are deleted from this browser. Download a backup first if you may need them. This cannot be undone.',
      confirmLabel: 'Delete everything',
      destructive: true,
    });
    if (!ok) return;
    try {
      await clearAllData();
      usePreferencesStore.setState(DEFAULT_PREFERENCES);
      setRestored('All data was deleted.');
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };

  return (
    <SectionCard
      id="backup"
      title="Backup and restore"
      subtitle="Move your data between browsers or keep a copy"
    >
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
            Stored items
          </Typography>
          <Table size="small" aria-label="Stored items">
            <TableBody>
              {BACKUP_TABLES.map((t) => (
                <TableRow key={t}>
                  <TableCell sx={{ pl: 0 }}>{TABLE_LABELS[t]}</TableCell>
                  <TableCell align="right">{counts ? counts[t].toLocaleString() : '…'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Box component="section" aria-label="Create a backup">
          <Typography variant="subtitle2" component="h3">
            Create a backup
          </Typography>
          <FormGroup>
            {SECTIONS.map((s) => (
              <FormControlLabel
                key={s}
                control={
                  <Checkbox
                    size="small"
                    checked={sections.has(s)}
                    onChange={(e) => {
                      setSections((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(s);
                        else next.delete(s);
                        return next;
                      });
                    }}
                  />
                }
                label={SECTION_LABELS[s]}
              />
            ))}
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={includeSecrets}
                  onChange={(e) => {
                    setIncludeSecrets(e.target.checked);
                  }}
                />
              }
              label="Include saved credentials and stored secret values"
            />
          </FormGroup>
          {includeSecrets ? (
            <Alert severity="warning" sx={{ my: 1 }}>
              The file will contain passwords, tokens and keys you chose to store, in plain text.
              Keep it private.
            </Alert>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Credentials and secret values are left out; {'{{variable}}'} references are kept.
            </Typography>
          )}
          <Button
            variant="contained"
            disabled={busy || sections.size === 0}
            onClick={() => void download()}
          >
            Download backup
          </Button>
        </Box>

        <Box component="section" aria-label="Restore a backup">
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
            Restore a backup
          </Typography>
          <UploadButton
            label="Choose backup file"
            rules={BACKUP_FILE_RULES}
            onError={notify.error}
            onText={(text) => {
              try {
                setPending(parseBackup(text, CURRENT_SCHEMA_VERSION));
                setMode('merge');
              } catch (error) {
                notify.error(toUserMessage(error));
              }
            }}
          />
          {restored && (
            <Alert
              severity="success"
              sx={{ mt: 1.5 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    window.location.reload();
                  }}
                >
                  Reload now
                </Button>
              }
            >
              {restored} Reload DevStudio so every open tool picks up the data.
            </Alert>
          )}
        </Box>

        <Box component="section" aria-label="Danger zone">
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
            Danger zone
          </Typography>
          <Button variant="outlined" color="error" onClick={() => void deleteAll()}>
            Delete all data…
          </Button>
        </Box>
      </Stack>

      <Dialog
        open={pending !== null}
        onClose={() => {
          setPending(null);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="restore-title"
      >
        <DialogTitle id="restore-title">Restore backup</DialogTitle>
        <DialogContent dividers>
          {pending && (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                {pending.exportedAt
                  ? `Created ${new Date(pending.exportedAt).toLocaleString()}`
                  : 'Creation date unknown'}
                {pending.appVersion ? ` with DevStudio ${pending.appVersion}` : ''}.
              </Typography>
              <Table size="small" aria-label="Backup contents">
                <TableBody>
                  {BACKUP_TABLES.filter((t) => pending.counts[t] !== undefined).map((t) => (
                    <TableRow key={t}>
                      <TableCell sx={{ pl: 0 }}>{TABLE_LABELS[t]}</TableCell>
                      <TableCell align="right">
                        {pending.counts[t]}
                        {pending.skipped[t] ? ` (${String(pending.skipped[t])} invalid)` : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pending.data.preferences !== null && (
                <Typography variant="body2">Preferences (theme, editor) are included.</Typography>
              )}
              {pending.includesSecrets && (
                <Alert severity="warning">
                  This backup contains credentials and secret values.
                </Alert>
              )}
              {pending.warnings.map((w) => (
                <Alert key={w} severity="info" sx={{ py: 0 }}>
                  {w}
                </Alert>
              ))}
              <RadioGroup
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value === 'replace' ? 'replace' : 'merge');
                }}
                aria-label="Restore mode"
              >
                <FormControlLabel
                  value="merge"
                  control={<Radio size="small" />}
                  label="Merge: add items, replacing those with the same id"
                />
                <FormControlLabel
                  value="replace"
                  control={<Radio size="small" />}
                  label="Replace: clear these tables first, then restore"
                />
              </RadioGroup>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPending(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={mode === 'replace' ? 'error' : 'primary'}
            disabled={busy}
            onClick={() => void restore()}
          >
            Restore
          </Button>
        </DialogActions>
      </Dialog>
    </SectionCard>
  );
}
