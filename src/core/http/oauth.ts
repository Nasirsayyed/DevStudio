import { ValidationError } from '../errors/AppError';
import { cryptoRandom, randomFromCharset, type RandomSource } from '../random/secureRandom';
import { tryParseJson } from '../security/safeJsonParse';
import type { RequestAuth } from './model';

/** RFC 7636 unreserved characters. */
const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export type OAuthConfig = RequestAuth['oauth2'];

export interface PkcePair {
  verifier: string;
  challenge: string;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Code verifier (64 secure random characters) and its S256 challenge. */
export async function createPkce(source: RandomSource = cryptoRandom): Promise<PkcePair> {
  const verifier = randomFromCharset(PKCE_CHARSET, 64, source);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

/** Opaque `state` value that ties the redirect to this request (CSRF protection). */
export function createState(source: RandomSource = cryptoRandom): string {
  return randomFromCharset(PKCE_CHARSET, 32, source);
}

function httpsUrl(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ValidationError(`Enter the ${label} as a full URL (https://…).`);
  }
  const local =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
    throw new ValidationError(`The ${label} must use https (http is allowed only for localhost).`);
  return url;
}

export function validateOAuthConfig(c: OAuthConfig): void {
  if (!c.clientId.trim()) throw new ValidationError('Enter the client ID.');
  httpsUrl(c.tokenUrl, 'token URL');
  if (c.grant === 'authorization_code') httpsUrl(c.authUrl, 'authorization URL');
  else if (!c.clientSecret.trim())
    throw new ValidationError('Client credentials need a client secret.');
}

/** URL of the provider's login page (authorization code flow with PKCE). */
export function authorizationUrl(
  c: OAuthConfig,
  redirectUri: string,
  state: string,
  challenge: string,
): string {
  const url = httpsUrl(c.authUrl, 'authorization URL');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', c.clientId.trim());
  url.searchParams.set('redirect_uri', redirectUri);
  if (c.scope.trim()) url.searchParams.set('scope', c.scope.trim());
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export interface TokenRequest {
  url: string;
  headers: [string, string][];
  body: string;
}

/** Token endpoint request (form-encoded) for either grant. */
export function tokenRequest(
  c: OAuthConfig,
  grant:
    | { type: 'client_credentials' }
    | { type: 'authorization_code'; code: string; verifier: string; redirectUri: string },
): TokenRequest {
  const url = httpsUrl(c.tokenUrl, 'token URL').toString();
  const body = new URLSearchParams();
  body.set('grant_type', grant.type);
  const headers: [string, string][] = [
    ['Content-Type', 'application/x-www-form-urlencoded'],
    ['Accept', 'application/json'],
  ];
  if (grant.type === 'authorization_code') {
    body.set('code', grant.code);
    body.set('redirect_uri', grant.redirectUri);
    body.set('code_verifier', grant.verifier);
    body.set('client_id', c.clientId.trim());
    if (c.clientSecret.trim()) body.set('client_secret', c.clientSecret.trim());
  } else {
    // RFC 6749 §2.3.1: client authentication with HTTP Basic (form-encoded credentials).
    const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, '+');
    const pair = new TextEncoder().encode(
      `${enc(c.clientId.trim())}:${enc(c.clientSecret.trim())}`,
    );
    let binary = '';
    for (const b of pair) binary += String.fromCharCode(b);
    headers.push(['Authorization', `Basic ${btoa(binary)}`]);
    if (c.scope.trim()) body.set('scope', c.scope.trim());
  }
  return { url, headers, body: body.toString() };
}

export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number | null;
  scope: string | null;
}

/** Reads a token endpoint response; provider errors become readable messages. */
export function parseTokenResponse(status: number, text: string): TokenResponse {
  const parsed = tryParseJson(text);
  const value =
    parsed.ok && parsed.value !== null && typeof parsed.value === 'object'
      ? (parsed.value as Record<string, unknown>)
      : null;
  if (!value)
    throw new ValidationError(`The token endpoint answered ${String(status)} without a JSON body.`);
  if (typeof value.error === 'string') {
    const description =
      typeof value.error_description === 'string' ? `: ${value.error_description}` : '';
    throw new ValidationError(`The provider refused the request (${value.error}${description}).`);
  }
  if (status < 200 || status >= 300)
    throw new ValidationError(`The token endpoint answered ${String(status)}.`);
  if (typeof value.access_token !== 'string' || !value.access_token)
    throw new ValidationError('The response contains no access_token.');
  return {
    accessToken: value.access_token,
    tokenType: typeof value.token_type === 'string' ? value.token_type : 'Bearer',
    expiresIn: typeof value.expires_in === 'number' ? value.expires_in : null,
    scope: typeof value.scope === 'string' ? value.scope : null,
  };
}

/** Parameters the provider appended to the redirect URL. */
export function parseCallback(search: string): {
  code: string | null;
  state: string | null;
  error: string | null;
} {
  const p = new URLSearchParams(search);
  const error = p.get('error');
  return {
    code: p.get('code'),
    state: p.get('state'),
    error: error
      ? `${error}${p.get('error_description') ? `: ${p.get('error_description') ?? ''}` : ''}`
      : null,
  };
}
