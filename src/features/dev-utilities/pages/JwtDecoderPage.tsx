import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { formatDistanceStrict } from 'date-fns';
import { ShieldTick } from 'iconsax-reactjs';
import { useNavigate } from 'react-router';
import { CLAIM_DESCRIPTIONS, decodeJwt, tokenParts } from '@/core/jwt/decode';
import { isJsonObject } from '@/core/json/objects';
import { toUserMessage } from '@/core/errors/AppError';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useNow } from '@/hooks/useNow';
import { fontFamilies } from '@/theme/tokens';
import { JsonBlock } from '../components/JsonBlock';
import { MonoTextField } from '../components/MonoTextField';
import { UtilityPage } from '../components/UtilityPage';
import { useUtilitiesStore } from '../store';

const COLORS = { header: '#f43f5e', payload: '#a855f7', signature: '#06b6d4' };
const TIME_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time']);

function ColoredToken({ token }: { token: string }) {
  const [h = '', p = '', s = ''] = tokenParts(token);
  return (
    <Box
      aria-label="Token parts"
      sx={{
        fontFamily: fontFamilies.mono,
        fontSize: 13,
        wordBreak: 'break-all',
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'background.sunken',
      }}
    >
      <Box component="span" sx={{ color: COLORS.header }}>
        {h}
      </Box>
      .
      <Box component="span" sx={{ color: COLORS.payload }}>
        {p}
      </Box>
      .
      <Box component="span" sx={{ color: COLORS.signature }}>
        {s}
      </Box>
    </Box>
  );
}

export default function JwtDecoderPage() {
  const token = useUtilitiesStore((s) => s.jwt);
  const setToken = useUtilitiesStore((s) => s.setJwt);
  const navigate = useNavigate();
  const debounced = useDebouncedValue(token, 100);
  const now = useNow(1000);
  let decoded: ReturnType<typeof decodeJwt> | null = null;
  let error: string | null = null;
  if (debounced.trim()) {
    try {
      decoded = decodeJwt(debounced, now);
    } catch (e) {
      error = toUserMessage(e);
    }
  }
  const t = decoded?.timing;
  const statusChip = t
    ? {
        valid: {
          color: 'success' as const,
          label: `Not expired · expires ${t.expiresAt ? formatDistanceStrict(t.expiresAt, now, { addSuffix: true }) : ''}`,
        },
        expired: {
          color: 'error' as const,
          label: `Expired ${t.expiresAt ? formatDistanceStrict(t.expiresAt, now, { addSuffix: true }) : ''}`,
        },
        'not-yet-valid': {
          color: 'warning' as const,
          label: `Not valid yet · starts ${t.notBefore ? formatDistanceStrict(t.notBefore, now, { addSuffix: true }) : ''}`,
        },
        'no-expiry': { color: 'warning' as const, label: 'No expiry (exp) claim' },
      }[t.status]
    : null;
  const claims = decoded && isJsonObject(decoded.payload) ? Object.entries(decoded.payload) : [];

  return (
    <UtilityPage toolId="utils.jwt-decoder">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={1.5}>
          <MonoTextField
            label="JWT"
            placeholder="eyJhbGciOi…"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
            }}
            minRows={3}
          />
          <Typography variant="caption" color="text.secondary">
            Decoded locally. Tokens are never stored or sent anywhere.
          </Typography>
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
          {decoded && <ColoredToken token={debounced} />}
        </Stack>
      </Paper>
      {decoded && (
        <>
          <Alert
            severity="warning"
            variant="outlined"
            sx={{ borderRadius: 3 }}
            action={
              <Button
                size="small"
                startIcon={<ShieldTick size={16} color="currentColor" />}
                onClick={() => void navigate('/utils/jwt-verify')}
              >
                Verify signature
              </Button>
            }
          >
            <AlertTitle>Signature not verified</AlertTitle>
            Decoding only reads the token. Anyone can create a token with any content — verify the
            signature with the issuer&apos;s key before trusting it.
          </Alert>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Chip label={`Algorithm: ${decoded.algorithm}`} variant="outlined" />
            {statusChip && <Chip label={statusChip.label} color={statusChip.color} />}
            {decoded.signatureError ? (
              <Chip label="Malformed signature" color="error" />
            ) : (
              <Chip
                label={
                  decoded.signature ? `Signature: ${decoded.signatureBytes} bytes` : 'No signature'
                }
                variant="outlined"
              />
            )}
            {typeof decoded.header.kid === 'string' && (
              <Chip label={`Key id: ${decoded.header.kid}`} variant="outlined" />
            )}
          </Stack>
          {decoded.signatureError && (
            <Alert severity="error" sx={{ borderRadius: 3 }}>
              {decoded.signatureError}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
              <JsonBlock title="Header" value={decoded.header} color={COLORS.header} />
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <JsonBlock title="Payload" value={decoded.payload} color={COLORS.payload} />
            </Grid>
          </Grid>
          {claims.length > 0 && (
            <Paper variant="outlined" sx={{ borderRadius: 3, overflowX: 'auto' }}>
              <Table size="small" aria-label="Claims">
                <TableHead>
                  <TableRow>
                    <TableCell>Claim</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Meaning</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {claims.map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell sx={{ fontFamily: fontFamilies.mono }}>{k}</TableCell>
                      <TableCell sx={{ fontFamily: fontFamilies.mono, wordBreak: 'break-all' }}>
                        {JSON.stringify(v)}
                        {TIME_CLAIMS.has(k) && typeof v === 'number' && (
                          <Typography variant="caption" color="text.secondary" component="div">
                            {new Date(v * 1000).toISOString()} (
                            {formatDistanceStrict(v * 1000, now, { addSuffix: true })})
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {CLAIM_DESCRIPTIONS[k] ?? ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}
    </UtilityPage>
  );
}
