import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { CopyButton } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import type { RequestAuth } from '@/core/http/model';
import { SelectOption } from '@/components/workspace/OptionControls';
import {
  authorizationCodeToken,
  clientCredentialsToken,
  oauthRedirectUri,
} from '@/services/http/oauthClient';
import { isAbortError } from '@/services/workers/taskRunner';
import { fontFamilies } from '@/theme/tokens';

const mono = {
  htmlInput: { spellCheck: false, autoComplete: 'off', style: { fontFamily: fontFamilies.mono } },
};

type OAuth = RequestAuth['oauth2'];

/** OAuth 2.0 (client credentials, authorization code + PKCE). The token stays in memory. */
export function OAuth2Editor({
  config,
  onChange,
  resolve,
}: {
  config: OAuth;
  onChange: (c: OAuth) => void;
  /** Substitutes {{variables}} in the settings before they are used. */
  resolve: (text: string) => string;
}) {
  const [status, setStatus] = useState<{
    busy: boolean;
    error: string | null;
    info: string | null;
  }>({ busy: false, error: null, info: null });
  const controller = useRef<AbortController | null>(null);
  const set = (patch: Partial<OAuth>) => {
    onChange({ ...config, ...patch });
  };
  const redirectUri = oauthRedirectUri();

  const getToken = async () => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setStatus({
      busy: true,
      error: null,
      info:
        config.grant === 'authorization_code' ? 'Complete the sign-in in the pop-up window…' : null,
    });
    const resolved: OAuth = {
      ...config,
      tokenUrl: resolve(config.tokenUrl),
      authUrl: resolve(config.authUrl),
      clientId: resolve(config.clientId),
      clientSecret: resolve(config.clientSecret),
      scope: resolve(config.scope),
    };
    try {
      const token =
        config.grant === 'authorization_code'
          ? await authorizationCodeToken(resolved, c.signal)
          : await clientCredentialsToken(resolved, c.signal);
      if (controller.current !== c) return;
      set({ accessToken: token.accessToken });
      const expires = token.expiresIn
        ? ` It expires in ${String(Math.round(token.expiresIn / 60))} min.`
        : '';
      setStatus({
        busy: false,
        error: null,
        info: `Access token received.${expires} It is kept in memory only.`,
      });
    } catch (error) {
      if (controller.current !== c) return;
      setStatus({
        busy: false,
        error: isAbortError(error) ? null : toUserMessage(error),
        info: isAbortError(error) ? 'Cancelled.' : null,
      });
    }
  };

  return (
    <Stack spacing={1.5}>
      <SelectOption
        label="Grant type"
        value={config.grant}
        width={300}
        options={[
          { value: 'client_credentials', label: 'Client credentials' },
          { value: 'authorization_code', label: 'Authorization code (PKCE)' },
        ]}
        onChange={(grant) => {
          set({ grant });
        }}
      />
      {config.grant === 'authorization_code' && (
        <TextField
          size="small"
          label="Authorization URL"
          value={config.authUrl}
          onChange={(e) => {
            set({ authUrl: e.target.value });
          }}
          placeholder="https://auth.example.com/authorize"
          slotProps={mono}
        />
      )}
      <TextField
        size="small"
        label="Token URL"
        value={config.tokenUrl}
        onChange={(e) => {
          set({ tokenUrl: e.target.value });
        }}
        placeholder="https://auth.example.com/oauth/token"
        slotProps={mono}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          size="small"
          label="Client ID"
          value={config.clientId}
          onChange={(e) => {
            set({ clientId: e.target.value });
          }}
          sx={{ flex: 1 }}
          slotProps={mono}
        />
        <TextField
          size="small"
          label={
            config.grant === 'authorization_code' ? 'Client secret (optional)' : 'Client secret'
          }
          type="password"
          value={config.clientSecret}
          onChange={(e) => {
            set({ clientSecret: e.target.value });
          }}
          sx={{ flex: 1 }}
          slotProps={mono}
        />
      </Stack>
      <TextField
        size="small"
        label="Scope"
        value={config.scope}
        onChange={(e) => {
          set({ scope: e.target.value });
        }}
        placeholder="read write"
        slotProps={mono}
      />
      {config.grant === 'authorization_code' && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Redirect URI to register with the provider:
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontFamily: fontFamilies.mono, overflowWrap: 'anywhere' }}
          >
            {redirectUri}
          </Typography>
          <CopyButton label="Copy redirect URI" value={redirectUri} />
        </Stack>
      )}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
        <Button variant="outlined" disabled={status.busy} onClick={() => void getToken()}>
          Get access token
        </Button>
        {status.busy && (
          <Button
            onClick={() => {
              controller.current?.abort();
            }}
          >
            Cancel
          </Button>
        )}
        {config.accessToken && !status.busy && (
          <Button
            color="error"
            onClick={() => {
              set({ accessToken: '' });
              setStatus({ busy: false, error: null, info: null });
            }}
          >
            Forget token
          </Button>
        )}
        <Typography
          variant="body2"
          color={config.accessToken ? 'success.main' : 'text.secondary'}
          aria-label="Token status"
        >
          {config.accessToken ? 'Token ready: sent as Authorization: Bearer …' : 'No token yet'}
        </Typography>
      </Stack>
      {status.info && (
        <Alert severity="info" sx={{ py: 0 }}>
          {status.info}
        </Alert>
      )}
      {status.error && <Alert severity="error">{status.error}</Alert>}
      <Typography variant="caption" color="text.secondary">
        The token endpoint is called from your browser, so it must allow this site with CORS. Many
        providers allow it only for public (SPA) clients using PKCE. Tokens are never saved,
        exported or written to history.
      </Typography>
    </Stack>
  );
}
