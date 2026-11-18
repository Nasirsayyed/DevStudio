import {
  type CryptoKey,
  type JWK,
  type JWTVerifyResult,
  createLocalJWKSet,
  errors,
  importJWK,
  importSPKI,
  importX509,
  jwtVerify,
} from 'jose';
import { ValidationError } from '../errors/AppError';
import { decodeBase64 } from '../encoding/base64';
import { isJsonObject } from '../json/objects';
import type { JsonObject, JsonValue } from '../json/types';
import { safeJsonParse } from '../security/safeJsonParse';
import { decodeJwt } from './decode';

export type SecretEncoding = 'utf8' | 'base64' | 'hex';

export type VerificationKey =
  | { kind: 'secret'; secret: string; encoding: SecretEncoding }
  | { kind: 'pem'; pem: string }
  | { kind: 'jwk'; json: string };

export interface VerifyOptions {
  issuer?: string;
  audience?: string;
  /** Allowed clock skew in seconds for exp/nbf. */
  clockToleranceSeconds?: number;
  currentDate?: Date;
}

export type VerifyOutcome =
  | { status: 'verified'; header: JsonObject; payload: JsonValue }
  /** The signature is authentic, but exp/nbf/iss/aud checks failed. */
  | { status: 'claims-invalid'; reason: string; header: JsonObject; payload: JsonValue }
  | { status: 'invalid-signature'; reason: string }
  | { status: 'error'; reason: string };

const SYMMETRIC = /^HS(256|384|512)$/;
const SUPPORTED = /^(HS|RS|PS|ES)(256|384|512)$|^EdDSA$|^Ed25519$/;
/** Private JWK members that must never be needed for verification. */
const PRIVATE_JWK_MEMBERS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'];

/** jose checks instanceof Uint8Array; normalizing via the global constructor keeps realms consistent. */
const bytes = (data: ArrayLike<number>): Uint8Array => new Uint8Array(Array.from(data));

function secretBytes(secret: string, encoding: SecretEncoding): Uint8Array {
  if (!secret) throw new ValidationError('Enter the shared secret.');
  if (encoding === 'utf8') return bytes(new TextEncoder().encode(secret));
  if (encoding === 'hex') {
    const hex = secret.replace(/\s+/g, '');
    if (!/^([0-9a-fA-F]{2})+$/.test(hex))
      throw new ValidationError('The secret is not valid hexadecimal.');
    return bytes((hex.match(/../g) ?? []).map((b) => parseInt(b, 16)));
  }
  return bytes(decodeBase64(secret).bytes);
}

function publicJwk(jwk: JsonObject): JWK {
  const copy: JsonObject = { ...jwk };
  for (const m of PRIVATE_JWK_MEMBERS) Reflect.deleteProperty(copy, m);
  return copy;
}

async function keyFor(
  key: VerificationKey,
  alg: string,
): Promise<Uint8Array | CryptoKey | ReturnType<typeof createLocalJWKSet>> {
  if (key.kind === 'secret') {
    if (!SYMMETRIC.test(alg))
      throw new ValidationError(
        `The token uses ${alg}, which needs a public key — not a shared secret.`,
      );
    return secretBytes(key.secret, key.encoding);
  }
  if (SYMMETRIC.test(alg))
    throw new ValidationError(
      `The token uses ${alg} (HMAC), which needs the shared secret — not a public key.`,
    );
  if (key.kind === 'pem') {
    const pem = key.pem.trim();
    if (/PRIVATE KEY-----/.test(pem))
      throw new ValidationError(
        'That is a PRIVATE key. Paste the public key (or certificate) instead — never share private keys.',
      );
    if (/BEGIN CERTIFICATE-----/.test(pem)) return importX509(pem, alg);
    if (/BEGIN RSA PUBLIC KEY-----/.test(pem)) {
      throw new ValidationError(
        'PKCS#1 "RSA PUBLIC KEY" is not supported by Web Crypto. Convert it to SPKI ("BEGIN PUBLIC KEY"), e.g. openssl rsa -RSAPublicKey_in -pubout.',
      );
    }
    if (/BEGIN PUBLIC KEY-----/.test(pem)) return importSPKI(pem, alg);
    throw new ValidationError(
      'Expected a PEM public key ("-----BEGIN PUBLIC KEY-----") or certificate.',
    );
  }
  let parsed: unknown;
  try {
    parsed = safeJsonParse(key.json);
  } catch {
    throw new ValidationError('The JWK / JWKS is not valid JSON.');
  }
  if (!isJsonObject(parsed)) throw new ValidationError('A JWK must be a JSON object.');
  if (Array.isArray(parsed.keys)) {
    const keys = parsed.keys.filter(isJsonObject).map(publicJwk);
    return createLocalJWKSet({ keys });
  }
  if (parsed.kty === 'oct')
    throw new ValidationError(
      'Symmetric ("oct") JWKs are not supported here; use the shared-secret option.',
    );
  return importJWK(publicJwk(parsed), alg);
}

function describeJoseError(error: unknown): { claims: boolean; reason: string } {
  if (error instanceof errors.JWTExpired)
    return { claims: true, reason: `The token has expired (${error.claim} check failed).` };
  if (error instanceof errors.JWTClaimValidationFailed) {
    const what =
      {
        nbf: 'is not valid yet (nbf)',
        iss: 'issuer does not match',
        aud: 'audience does not match',
        iat: 'issued-at is invalid',
      }[error.claim] ?? `"${error.claim}" claim is invalid`;
    return { claims: true, reason: `The token ${what}: ${error.reason}.`.replace(/\.\.$/, '.') };
  }
  if (error instanceof errors.JWSSignatureVerificationFailed) {
    return {
      claims: false,
      reason:
        'Signature does NOT match: the token was not signed with this key, or it was modified.',
    };
  }
  if (error instanceof errors.JWKSNoMatchingKey)
    return { claims: false, reason: 'No key in the JWKS matches the token (kid / alg).' };
  if (error instanceof errors.JOSENotSupported)
    return { claims: false, reason: `Not supported: ${error.message}` };
  if (error instanceof errors.JOSEAlgNotAllowed)
    return { claims: false, reason: "The key does not allow this token's algorithm." };
  return { claims: false, reason: error instanceof Error ? error.message : String(error) };
}

/**
 * Verifies a JWT's signature (and, when configured, exp/nbf/iss/aud) using the
 * Web Crypto API via jose. Never reports success unless the signature checks out.
 */
export async function verifyJwt(
  token: string,
  key: VerificationKey,
  options: VerifyOptions = {},
): Promise<VerifyOutcome> {
  let decoded;
  try {
    decoded = decodeJwt(token, options.currentDate?.getTime());
  } catch (error) {
    return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
  }
  const alg = decoded.algorithm;
  if (alg.toLowerCase() === 'none')
    return {
      status: 'invalid-signature',
      reason: 'Unsigned tokens (alg "none") can never be verified and must be rejected.',
    };
  if (!SUPPORTED.test(alg))
    return {
      status: 'error',
      reason: `Algorithm "${alg}" is not supported by Web Crypto in this browser.`,
    };
  if (!decoded.signature)
    return { status: 'invalid-signature', reason: 'The token has no signature.' };

  let verificationKey;
  try {
    verificationKey = await keyFor(key, alg);
  } catch (error) {
    return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
  }
  const compact = token
    .trim()
    .replace(/^bearer\s+/i, '')
    .replace(/^["']|["']$/g, '');
  const verifyOptions = {
    algorithms: [alg],
    ...(options.issuer ? { issuer: options.issuer } : {}),
    ...(options.audience ? { audience: options.audience } : {}),
    clockTolerance: options.clockToleranceSeconds ?? 0,
    ...(options.currentDate ? { currentDate: options.currentDate } : {}),
  };
  try {
    const result: JWTVerifyResult =
      typeof verificationKey === 'function'
        ? await jwtVerify(compact, verificationKey, verifyOptions)
        : await jwtVerify(compact, verificationKey, verifyOptions);
    return {
      status: 'verified',
      header: result.protectedHeader as JsonObject,
      payload: result.payload as JsonValue,
    };
  } catch (error) {
    const { claims, reason } = describeJoseError(error);
    // jose validates claims only after the signature verified.
    if (claims)
      return { status: 'claims-invalid', reason, header: decoded.header, payload: decoded.payload };
    return error instanceof errors.JWSSignatureVerificationFailed ||
      error instanceof errors.JWKSNoMatchingKey
      ? { status: 'invalid-signature', reason }
      : { status: 'error', reason };
  }
}
