import { Alert, Stack, TextField } from '@mui/material';
import { SelectOption } from '@/components/workspace/OptionControls';
import type { RequestAuth } from '@/core/http/model';
import { fontFamilies } from '@/theme/tokens';
import { OAuth2Editor } from './OAuth2Editor';

const mono = {
  htmlInput: { spellCheck: false, autoComplete: 'off', style: { fontFamily: fontFamilies.mono } },
};

export function AuthEditor({
  auth,
  onChange,
  resolve,
}: {
  auth: RequestAuth;
  onChange: (a: RequestAuth) => void;
  resolve: (text: string) => string;
}) {
  const set = (patch: Partial<RequestAuth>) => {
    onChange({ ...auth, ...patch });
  };
  return (
    <Stack spacing={1.5} sx={{ maxWidth: 560 }}>
      <SelectOption
        label="Type"
        value={auth.type}
        width={220}
        options={[
          { value: 'none', label: 'No authentication' },
          { value: 'basic', label: 'Basic' },
          { value: 'bearer', label: 'Bearer token' },
          { value: 'apikey', label: 'API key' },
          { value: 'oauth2', label: 'OAuth 2.0' },
        ]}
        onChange={(type) => {
          set({ type });
        }}
      />
      {auth.type === 'basic' && (
        <>
          <TextField
            size="small"
            label="Username"
            value={auth.username}
            onChange={(e) => {
              set({ username: e.target.value });
            }}
            slotProps={mono}
          />
          <TextField
            size="small"
            label="Password"
            type="password"
            value={auth.password}
            onChange={(e) => {
              set({ password: e.target.value });
            }}
            slotProps={mono}
          />
        </>
      )}
      {auth.type === 'bearer' && (
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            label="Prefix"
            value={auth.prefix}
            onChange={(e) => {
              set({ prefix: e.target.value });
            }}
            sx={{ width: 120 }}
            slotProps={mono}
          />
          <TextField
            size="small"
            label="Token"
            type="password"
            value={auth.token}
            onChange={(e) => {
              set({ token: e.target.value });
            }}
            sx={{ flex: 1 }}
            slotProps={mono}
          />
        </Stack>
      )}
      {auth.type === 'apikey' && (
        <>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              label="Name"
              value={auth.apiKeyName}
              onChange={(e) => {
                set({ apiKeyName: e.target.value });
              }}
              sx={{ flex: 1 }}
              slotProps={mono}
            />
            <SelectOption
              label="Send in"
              value={auth.apiKeyIn}
              width={140}
              options={[
                { value: 'header', label: 'Header' },
                { value: 'query', label: 'Query string' },
              ]}
              onChange={(apiKeyIn) => {
                set({ apiKeyIn });
              }}
            />
          </Stack>
          <TextField
            size="small"
            label="Value"
            type="password"
            value={auth.apiKeyValue}
            onChange={(e) => {
              set({ apiKeyValue: e.target.value });
            }}
            slotProps={mono}
          />
        </>
      )}
      {auth.type === 'oauth2' && (
        <OAuth2Editor
          config={auth.oauth2}
          resolve={resolve}
          onChange={(oauth2) => {
            set({ oauth2 });
          }}
        />
      )}
      {auth.type !== 'none' && (
        <Alert severity="info" variant="outlined">
          Tip: use a secret environment variable such as <code>{'{{token}}'}</code>. Credentials
          typed here are not saved unless you choose to when saving the request, and are never
          written to history.
        </Alert>
      )}
    </Stack>
  );
}
