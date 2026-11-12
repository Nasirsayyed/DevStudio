import { ValidationError } from '../errors/AppError';
import { decodeBase64 } from '../encoding/base64';
import { isJsonObject } from '../json/objects';
import type { JsonObject, JsonValue } from '../json/types';
import { safeJsonParse } from '../security/safeJsonParse';

export interface JwtTiming {
  issuedAt: Date | null;
  notBefore: Date | null;
  expiresAt: Date | null;
  status: 'valid' | 'expired' | 'not-yet-valid' | 'no-expiry';
}

export interface DecodedJwt {
  header: JsonObject;
  payload: JsonValue;
  /** Raw base64url signature segment. */
  signature: string;
  signatureBytes: number;
  /** Set when the signature segment is not valid Base64URL (the token cannot be verified). */
  signatureError: string | null;
  algorithm: string;
  timing: JwtTiming;
  /**
   * Always false: decoding reads the token WITHOUT checking its signature.
   * Use verifyJwt() with a key to establish authenticity.
   */
  verified: false;
}

export const CLAIM_DESCRIPTIONS: Readonly<Record<string, string>> = {
  iss: 'Issuer — who created and signed the token',
  sub: 'Subject — whom the token refers to (usually the user id)',
  aud: 'Audience — the recipients the token is intended for',
  exp: 'Expiration time — must not be accepted after this',
  nbf: 'Not before — must not be accepted before this',
  iat: 'Issued at — when the token was created',
  jti: 'JWT ID — unique identifier (prevents replay)',
  azp: 'Authorized party — the client the token was issued to',
  scope: 'OAuth 2.0 scopes granted',
  scp: 'Scopes granted (Microsoft identity platform)',
  roles: 'Roles assigned to the subject',
  nonce: 'Value binding the token to a client session',
  auth_time: 'When the user authenticated',
  sid: 'Session id',
  tid: 'Tenant id (Microsoft Entra ID)',
  oid: 'Object id of the user (Microsoft Entra ID)',
  email: 'Email address',
  email_verified: 'Whether the email address is verified',
  name: 'Full name',
  preferred_username: 'Preferred username',
  acr: 'Authentication context class reference',
  amr: 'Authentication methods used',
  client_id: 'OAuth 2.0 client id',
};

function decodePart(part: string, label: 'header' | 'payload'): JsonValue {
  let text: string | null;
  try {
    text = decodeBase64(part).text;
  } catch (error) {
    throw new ValidationError(
      `The ${label} is not valid Base64URL: ${error instanceof Error ? error.message : ''}`.trim(),
    );
  }
  if (text === null) throw new ValidationError(`The ${label} does not decode to UTF-8 text.`);
  try {
    return safeJsonParse(text) as JsonValue;
  } catch {
    throw new ValidationError(`The ${label} is not valid JSON.`);
  }
}

const toDate = (v: JsonValue | undefined): Date | null =>
  typeof v === 'number' && Number.isFinite(v) ? new Date(v * 1000) : null;

/** Splits a token into parts, accepting an optional "Bearer " prefix and surrounding whitespace/quotes. */
export function tokenParts(input: string): string[] {
  const token = input
    .trim()
    .replace(/^bearer\s+/i, '')
    .replace(/^["']|["']$/g, '');
  if (!token) throw new ValidationError('Paste a JWT (three Base64URL parts separated by dots).');
  return token.split('.');
}

/** Decodes a JWS compact token. Does NOT verify the signature. */
export function decodeJwt(input: string, now: number = Date.now()): DecodedJwt {
  const parts = tokenParts(input);
  if (parts.length === 5)
    throw new ValidationError(
      'This is an encrypted token (JWE, 5 parts). Its payload cannot be read without the decryption key.',
    );
  if (parts.length !== 3)
    throw new ValidationError(`A JWT has 3 parts separated by dots; this has ${parts.length}.`);
  const [h = '', p = '', s = ''] = parts;
  const header = decodePart(h, 'header');
  if (!isJsonObject(header)) throw new ValidationError('The JWT header must be a JSON object.');
  if (typeof header.alg !== 'string')
    throw new ValidationError('The JWT header has no "alg" (algorithm).');
  const payload = decodePart(p, 'payload');
  // A broken signature does not prevent reading the header and payload; it is reported instead.
  let signatureBytes = 0;
  let signatureError: string | null = null;
  if (s) {
    try {
      signatureBytes = decodeBase64(s).bytes.length;
    } catch {
      signatureError = 'The signature is not valid Base64URL, so this token can never verify.';
    }
  }
  const claims = isJsonObject(payload) ? payload : {};
  const issuedAt = toDate(claims.iat);
  const notBefore = toDate(claims.nbf);
  const expiresAt = toDate(claims.exp);
  let status: JwtTiming['status'] = expiresAt ? 'valid' : 'no-expiry';
  if (notBefore && notBefore.getTime() > now) status = 'not-yet-valid';
  if (expiresAt && expiresAt.getTime() <= now) status = 'expired';
  return {
    header,
    payload,
    signature: s,
    signatureBytes,
    signatureError,
    algorithm: header.alg,
    timing: { issuedAt, notBefore, expiresAt, status },
    verified: false,
  };
}
