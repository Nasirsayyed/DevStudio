import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Send2 } from 'iconsax-reactjs';
import { useMemo, useState } from 'react';
import { Kbd } from '@/components';
import { SwitchOption } from '@/components/workspace/OptionControls';
import { HTTP_METHODS, type KeyValue, type RequestDraft } from '@/core/http/model';
import { buildRequest } from '@/core/http/build';
import type { VariableScope } from '@/core/http/interpolate';
import { toUserMessage } from '@/core/errors/AppError';
import { fontFamilies } from '@/theme/tokens';
import type { HttpMethod } from '@/types/entities';
import { AuthEditor } from './AuthEditor';
import { BodyEditor } from './BodyEditor';
import { KeyValueEditor } from './KeyValueEditor';

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'success.main',
  POST: 'warning.main',
  PUT: 'info.main',
  PATCH: 'secondary.main',
  DELETE: 'error.main',
  HEAD: 'text.secondary',
  OPTIONS: 'text.secondary',
};

const count = (rows: readonly KeyValue[]) => rows.filter((r) => r.enabled && r.key.trim()).length;

/** Request line (method, URL, Send) and the Params/Headers/Body/Auth/Settings tabs. */
export function RequestEditor({
  draft,
  onChange,
  scopes,
  sending,
  onSend,
}: {
  draft: RequestDraft;
  onChange: (patch: Partial<RequestDraft>) => void;
  scopes: VariableScope[];
  sending: boolean;
  onSend: () => void;
}) {
  const [tab, setTab] = useState(0);
  // A dry run reports unresolved variables and other problems before sending.
  const check = useMemo(() => {
    if (!draft.url.trim())
      return { warnings: [] as string[], error: null, missing: [] as string[] };
    try {
      const p = buildRequest(draft, scopes);
      return { warnings: p.warnings, error: null, missing: p.missing };
    } catch (error) {
      return { warnings: [], error: toUserMessage(error), missing: [] };
    }
  }, [draft, scopes]);

  const tabs = [
    { label: 'Params', n: count(draft.params) },
    { label: 'Headers', n: count(draft.headers) },
    { label: 'Body', n: draft.body.mode === 'none' ? 0 : 1 },
    { label: 'Auth', n: draft.auth.type === 'none' ? 0 : 1 },
    { label: 'Settings', n: 0 },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Box
        component="form"
        aria-label="Request line"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'flex-start',
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
        }}
      >
        <TextField
          select
          size="small"
          label="Method"
          value={draft.method}
          onChange={(e) => {
            const m = HTTP_METHODS.find((x) => x === e.target.value);
            if (m) onChange({ method: m });
          }}
          sx={{
            width: 120,
            flexShrink: 0,
            '& .MuiSelect-select': { fontWeight: 700, color: METHOD_COLORS[draft.method] },
          }}
        >
          {HTTP_METHODS.map((m) => (
            <MenuItem key={m} value={m} sx={{ fontWeight: 700, color: METHOD_COLORS[m] }}>
              {m}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="URL"
          placeholder="https://api.example.com/items or {{baseUrl}}/items"
          value={draft.url}
          onChange={(e) => {
            onChange({ url: e.target.value });
          }}
          sx={{ flex: 1, minWidth: 200 }}
          slotProps={{
            htmlInput: {
              spellCheck: false,
              autoComplete: 'off',
              style: { fontFamily: fontFamilies.mono },
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={sending || !draft.url.trim()}
          startIcon={<Send2 size={16} color="currentColor" />}
          sx={{ flexShrink: 0, height: 40 }}
        >
          Send
        </Button>
      </Box>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ alignItems: 'center', flexWrap: 'wrap', mt: 0.75, minHeight: 24 }}
      >
        <Box sx={{ display: { xs: 'none', sm: 'inline-flex' }, alignItems: 'center', gap: 0.5 }}>
          <Kbd combo="mod+enter" size="small" />
          <Typography variant="caption" color="text.secondary">
            sends · <Kbd combo="mod+s" size="small" /> saves
          </Typography>
        </Box>
        {check.missing.length > 0 && (
          <Box
            role="status"
            aria-label="Unresolved variables"
            sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Typography variant="caption" color="warning.main">
              Not defined:
            </Typography>
            {check.missing.map((m) => (
              <Chip
                key={m}
                size="small"
                color="warning"
                variant="outlined"
                label={`{{${m}}}`}
                sx={{ fontFamily: fontFamilies.mono }}
              />
            ))}
          </Box>
        )}
      </Stack>
      {check.error && (
        <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
          {check.error}
        </Alert>
      )}
      {check.warnings
        .filter((w) => !w.startsWith('Variables not defined'))
        .map((w) => (
          <Alert key={w} severity="info" sx={{ mt: 1, py: 0 }}>
            {w}
          </Alert>
        ))}
      <Tabs
        value={tab}
        onChange={(_, v: number) => {
          setTab(v);
        }}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Request parts"
        sx={{ mt: 1, minHeight: 40, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((t) => (
          <Tab
            key={t.label}
            sx={{ minHeight: 40 }}
            label={
              t.n > 0 && t.label !== 'Body' && t.label !== 'Auth' ? (
                `${t.label} (${String(t.n)})`
              ) : t.n > 0 ? (
                <Badge variant="dot" color="primary" sx={{ '& .MuiBadge-badge': { right: -6 } }}>
                  {t.label}
                </Badge>
              ) : (
                t.label
              )
            }
            aria-label={t.label}
          />
        ))}
      </Tabs>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', pt: 1.5 }}>
        {tab === 0 && (
          <KeyValueEditor
            label="Query parameters"
            rows={draft.params}
            onChange={(params) => {
              onChange({ params });
            }}
          />
        )}
        {tab === 1 && (
          <Stack spacing={1}>
            <KeyValueEditor
              label="Headers"
              rows={draft.headers}
              onChange={(headers) => {
                onChange({ headers });
              }}
            />
            <Typography variant="caption" color="text.secondary">
              The browser controls some headers itself (Host, Cookie, Origin, User-Agent…); those
              are not sent.
            </Typography>
          </Stack>
        )}
        {tab === 2 && (
          <BodyEditor
            body={draft.body}
            onChange={(body) => {
              onChange({ body });
            }}
            disabled={draft.method === 'GET' || draft.method === 'HEAD'}
          />
        )}
        {tab === 3 && (
          <AuthEditor
            auth={draft.auth}
            onChange={(auth) => {
              onChange({ auth });
            }}
          />
        )}
        {tab === 4 && (
          <Stack spacing={1.5} sx={{ maxWidth: 560 }}>
            <TextField
              size="small"
              type="number"
              label="Timeout (ms, 0 = none)"
              value={draft.settings.timeoutMs}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n))
                  onChange({
                    settings: { ...draft.settings, timeoutMs: Math.min(600_000, Math.max(0, n)) },
                  });
              }}
              sx={{ width: 220 }}
            />
            <SwitchOption
              label="Follow redirects"
              checked={draft.settings.followRedirects}
              onChange={(followRedirects) => {
                onChange({ settings: { ...draft.settings, followRedirects } });
              }}
            />
            <SwitchOption
              label="Send cookies (credentials: include)"
              checked={draft.settings.includeCredentials}
              onChange={(includeCredentials) => {
                onChange({ settings: { ...draft.settings, includeCredentials } });
              }}
            />
            <Alert severity="info">
              Requests are sent by your browser with fetch. Cross-origin APIs must allow this site
              with CORS headers; DevStudio never routes requests through a proxy. With redirects
              off, browsers hide the 3xx response (status 0).
            </Alert>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
