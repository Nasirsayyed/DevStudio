import {
  Alert,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { PageContainer, SectionCard, ToolHeader, useConfirm, useNotify } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import { formatBytes } from '@/core/format/bytes';
import { CURRENT_SCHEMA_VERSION } from '@/services/db/database';
import { toolUsageRepository } from '@/services/db/repositories';
import type { ThemeMode } from '@/services/preferences/preferences';
import {
  type StorageEstimateResult,
  getStorageEstimate,
  requestPersistentStorage,
} from '@/services/storage/storageEstimate';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useUiStore } from '@/stores/uiStore';
import { getModule } from '@/tools/modules';

function AppearanceSection() {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const collapsed = usePreferencesStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = usePreferencesStore((s) => s.setSidebarCollapsed);
  return (
    <SectionCard id="appearance" title="Appearance" subtitle="Saved on this device">
      <Stack spacing={2}>
        <FormControl>
          <FormLabel id="theme-mode-label">Theme</FormLabel>
          <RadioGroup
            row
            aria-labelledby="theme-mode-label"
            value={themeMode}
            onChange={(e) => {
              setThemeMode(e.target.value as ThemeMode);
            }}
          >
            <FormControlLabel value="light" control={<Radio />} label="Light" />
            <FormControlLabel value="dark" control={<Radio />} label="Dark" />
            <FormControlLabel value="system" control={<Radio />} label="System" />
          </RadioGroup>
        </FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={collapsed}
              onChange={(e) => {
                setSidebarCollapsed(e.target.checked);
              }}
            />
          }
          label="Collapse sidebar to icons (desktop)"
        />
      </Stack>
    </SectionCard>
  );
}

function EditorSection() {
  const editor = usePreferencesStore((s) => s.editor);
  const setEditor = usePreferencesStore((s) => s.setEditorPreferences);
  return (
    <SectionCard
      id="editor"
      title="Code editor"
      subtitle="Applied to every code editor in DevStudio"
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={2}>
          <TextField
            select
            label="Font size"
            size="small"
            value={editor.fontSize}
            onChange={(e) => {
              setEditor({ fontSize: Number(e.target.value) });
            }}
            sx={{ width: 140 }}
          >
            {[12, 13, 14, 15, 16, 18, 20].map((n) => (
              <MenuItem key={n} value={n}>
                {n}px
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Tab size"
            size="small"
            value={editor.tabSize}
            onChange={(e) => {
              setEditor({ tabSize: Number(e.target.value) as 2 | 4 | 8 });
            }}
            sx={{ width: 140 }}
          >
            {[2, 4, 8].map((n) => (
              <MenuItem key={n} value={n}>
                {n} spaces
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <FormControlLabel
          control={
            <Switch
              checked={editor.wordWrap}
              onChange={(e) => {
                setEditor({ wordWrap: e.target.checked });
              }}
            />
          }
          label="Word wrap"
        />
        <FormControlLabel
          control={
            <Switch
              checked={editor.minimap}
              onChange={(e) => {
                setEditor({ minimap: e.target.checked });
              }}
            />
          }
          label="Show minimap"
        />
      </Stack>
    </SectionCard>
  );
}

function StorageSection() {
  const notify = useNotify();
  const confirm = useConfirm();
  const clearRecentTools = usePreferencesStore((s) => s.clearRecentTools);
  const [estimate, setEstimate] = useState<StorageEstimateResult | null>(null);

  const refresh = useCallback(() => {
    getStorageEstimate()
      .then(setEstimate)
      .catch(() => {
        setEstimate({ supported: false, usageBytes: 0, quotaBytes: 0, persisted: false });
      });
  }, []);

  useEffect(refresh, [refresh]);

  const percent = estimate?.quotaBytes
    ? Math.min(100, (estimate.usageBytes / estimate.quotaBytes) * 100)
    : 0;

  const onPersist = async () => {
    const granted = await requestPersistentStorage();
    if (granted)
      notify.success(
        'Persistent storage granted. The browser will not evict your data automatically.',
      );
    else
      notify.warning(
        'The browser declined persistent storage. Export backups regularly to be safe.',
      );
    refresh();
  };

  const onResetUsage = async () => {
    const ok = await confirm({
      title: 'Reset usage statistics?',
      message: 'Tool usage counters on the dashboard will be cleared. Saved work is not affected.',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (!ok) return;
    try {
      await toolUsageRepository.clear();
      clearRecentTools();
      notify.success('Usage statistics and recent tools cleared.');
    } catch (error) {
      notify.error(toUserMessage(error));
    }
  };

  return (
    <SectionCard id="storage" title="Storage" subtitle="All data stays in this browser">
      <Stack spacing={2}>
        {estimate && !estimate.supported && (
          <Alert severity="info">This browser does not report storage usage.</Alert>
        )}
        {estimate?.supported && (
          <div>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="body2">
                {formatBytes(estimate.usageBytes)} used of {formatBytes(estimate.quotaBytes)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {percent.toFixed(percent < 1 ? 2 : 0)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={percent}
              aria-label="Storage usage"
              sx={{ height: 6, borderRadius: 3 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Persistent storage:{' '}
              {estimate.persisted
                ? 'granted'
                : 'not granted (data may be evicted under storage pressure)'}
            </Typography>
          </div>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {estimate?.supported && !estimate.persisted && (
            <Button variant="outlined" onClick={() => void onPersist()}>
              Request persistent storage
            </Button>
          )}
          <Button variant="outlined" color="error" onClick={() => void onResetUsage()}>
            Reset usage statistics
          </Button>
        </Stack>
        <Alert severity="info" variant="outlined">
          Full backup, restore and data export arrive in Phase 11.
        </Alert>
      </Stack>
    </SectionCard>
  );
}

function AboutSection() {
  const setShortcutsDialogOpen = useUiStore((s) => s.setShortcutsDialogOpen);
  return (
    <SectionCard id="about" title="About">
      <Stack spacing={1.5}>
        <Typography variant="body2">
          DevStudio v{__APP_VERSION__} · database schema v{CURRENT_SCHEMA_VERSION}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          DevStudio runs entirely in your browser. Nothing is sent to a server unless you explicitly
          send an API request.
        </Typography>
        <div>
          <Button
            variant="outlined"
            onClick={() => {
              setShortcutsDialogOpen(true);
            }}
          >
            View keyboard shortcuts
          </Button>
        </div>
      </Stack>
    </SectionCard>
  );
}

export default function SettingsPage() {
  const mod = getModule('settings');
  return (
    <PageContainer>
      <ToolHeader title={mod.title} description={mod.description} icon={mod.icon} />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <AppearanceSection />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <EditorSection />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <StorageSection />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <AboutSection />
        </Grid>
      </Grid>
    </PageContainer>
  );
}
