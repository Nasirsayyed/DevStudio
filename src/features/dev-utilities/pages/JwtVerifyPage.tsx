import {
  Alert,
  AlertTitle,
  Button,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { ShieldTick } from 'iconsax-reactjs';
import { useState } from 'react';
import { SelectOption } from '@/components/workspace/OptionControls';
import type { SecretEncoding, VerificationKey, VerifyOutcome } from '@/core/jwt/verify';
import { fontFamilies } from '@/theme/tokens';
import { JsonBlock } from '../components/JsonBlock';
import { MonoTextField } from '../components/MonoTextField';
import { UtilityPage } from '../components/UtilityPage';
import { useUtilitiesStore } from '../store';

type KeyKind = VerificationKey['kind'];

export default function JwtVerifyPage() {
  const token = useUtilitiesStore((s) => s.jwt);
  const setToken = useUtilitiesStore((s) => s.setJwt);
  // Keys are deliberately kept in component state only: never persisted.
  const [kind, setKind] = useState<KeyKind>('secret');
  const [secret, setSecret] = useState('');
  const [encoding, setEncoding] = useState<SecretEncoding>('utf8');
  const [pem, setPem] = useState('');
  const [jwk, setJwk] = useState('');
  const [issuer, setIssuer] = useState('');
  const [audience, setAudience] = useState('');
  const [tolerance, setTolerance] = useState('0');
  const [busy, setBusy] = useState(false);
  // A result belongs to the exact inputs it was computed for: editing the token, key or
  // expectations hides it, and a slow verification that finishes after an edit is ignored.
  const inputs = JSON.stringify([
    token,
    kind,
    secret,
    encoding,
    pem,
    jwk,
    issuer,
    audience,
    tolerance,
  ]);
  const [result, setResult] = useState<{ inputs: string; outcome: VerifyOutcome } | null>(null);
  const outcome = result?.inputs === inputs ? result.outcome : null;

  const verify = async () => {
    setBusy(true);
    const forInputs = inputs;
    const { verifyJwt } = await import('@/core/jwt/verify');
    const key: VerificationKey =
      kind === 'secret'
        ? { kind, secret, encoding }
        : kind === 'pem'
          ? { kind, pem }
          : { kind, json: jwk };
    const verified = await verifyJwt(token, key, {
      ...(issuer.trim() ? { issuer: issuer.trim() } : {}),
      ...(audience.trim() ? { audience: audience.trim() } : {}),
      clockToleranceSeconds: Math.max(0, Number(tolerance) || 0),
    });
    setResult({ inputs: forInputs, outcome: verified });
    setBusy(false);
  };

  return (
    <UtilityPage toolId="utils.jwt-verify">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={2}>
          <MonoTextField
            label="JWT"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
            }}
            minRows={3}
          />
          <Tabs
            value={kind}
            onChange={(_, v: KeyKind) => {
              setKind(v);
            }}
            aria-label="Key type"
          >
            <Tab value="secret" label="Shared secret (HS256/384/512)" />
            <Tab value="pem" label="PEM public key / certificate" />
            <Tab value="jwk" label="JWK / JWKS" />
          </Tabs>
          {kind === 'secret' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Secret"
                type="password"
                autoComplete="off"
                value={secret}
                onChange={(e) => {
                  setSecret(e.target.value);
                }}
                fullWidth
                size="small"
                slotProps={{ htmlInput: { style: { fontFamily: fontFamilies.mono } } }}
              />
              <SelectOption
                label="Secret encoding"
                value={encoding}
                options={[
                  { value: 'utf8', label: 'Text (UTF-8)' },
                  { value: 'base64', label: 'Base64 / Base64URL' },
                  { value: 'hex', label: 'Hex' },
                ]}
                onChange={setEncoding}
                width={190}
              />
            </Stack>
          )}
          {kind === 'pem' && (
            <MonoTextField
              label="Public key or X.509 certificate (PEM)"
              placeholder={'-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----'}
              value={pem}
              onChange={(e) => {
                setPem(e.target.value);
              }}
            />
          )}
          {kind === 'jwk' && (
            <MonoTextField
              label="JWK or JWKS (JSON)"
              placeholder='{"keys":[{"kty":"RSA","kid":"…","n":"…","e":"AQAB"}]}'
              value={jwk}
              onChange={(e) => {
                setJwk(e.target.value);
              }}
            />
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label="Expected issuer (optional)"
                value={issuer}
                onChange={(e) => {
                  setIssuer(e.target.value);
                }}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Expected audience (optional)"
                value={audience}
                onChange={(e) => {
                  setAudience(e.target.value);
                }}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Clock tolerance (s)"
                type="number"
                value={tolerance}
                onChange={(e) => {
                  setTolerance(e.target.value);
                }}
                fullWidth
                size="small"
                slotProps={{ htmlInput: { min: 0, max: 3600 } }}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={<ShieldTick size={18} color="currentColor" />}
              disabled={!token.trim() || busy}
              onClick={() => void verify()}
            >
              Verify signature
            </Button>
            <Typography variant="caption" color="text.secondary">
              Verified locally with the Web Crypto API. Keys are never stored; private keys are
              refused.
            </Typography>
          </Stack>
        </Stack>
      </Paper>
      {outcome?.status === 'verified' && (
        <>
          <Alert severity="success" role="status" sx={{ borderRadius: 3 }}>
            <AlertTitle>Signature verified</AlertTitle>
            The token was signed with this key and has not been modified
            {issuer || audience ? '; issuer/audience match' : ''}; time claims are valid.
          </Alert>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
              <JsonBlock title="Verified header" value={outcome.header} />
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <JsonBlock title="Verified payload" value={outcome.payload} />
            </Grid>
          </Grid>
        </>
      )}
      {outcome?.status === 'claims-invalid' && (
        <Alert severity="warning" role="alert" sx={{ borderRadius: 3 }}>
          <AlertTitle>Signature is valid, but the token must be rejected</AlertTitle>
          {outcome.reason}
        </Alert>
      )}
      {outcome?.status === 'invalid-signature' && (
        <Alert severity="error" role="alert" sx={{ borderRadius: 3 }}>
          <AlertTitle>Invalid signature</AlertTitle>
          {outcome.reason}
        </Alert>
      )}
      {outcome?.status === 'error' && (
        <Alert severity="error" role="alert" sx={{ borderRadius: 3 }}>
          <AlertTitle>Could not verify</AlertTitle>
          {outcome.reason}
        </Alert>
      )}
    </UtilityPage>
  );
}
