import { bytesToBase64 } from '../encoding/base64';
import { ValidationError } from '../errors/AppError';
import { tryParseJson } from '../security/safeJsonParse';
import { interpolate, type VariableScope } from './interpolate';
import type { HttpMethod } from '@/types/entities';
import type { RequestDraft } from './model';

/** A request ready for `fetch`, after variables, params, auth and body were applied. */

export type PreparedBody =
  | { kind: 'none' }
  | { kind: 'text'; text: string }
  | { kind: 'form-data'; fields: { key: string; value: string; fileEntryId: string | null }[] }
  | { kind: 'binary' };

export interface PreparedRequest {
  method: HttpMethod;
  url: string;
  headers: [string, string][];
  body: PreparedBody;
  /** Variables without a value (left as {{name}}). */
  missing: string[];
  warnings: string[];
}

/** Headers browsers manage themselves; fetch silently drops them. */
const FORBIDDEN = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
]);
export function isForbiddenHeader(name: string): boolean {
  const n = name.toLowerCase();
  return FORBIDDEN.has(n) || n.startsWith('proxy-') || n.startsWith('sec-');
}

const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** Adds a scheme when it is missing: http for local addresses, https otherwise. */
export function withScheme(url: string): string {
  const u = url.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) return u;
  return /^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(u) ? `http://${u}` : `https://${u}`;
}

function utf8Base64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function buildRequest(
  d: RequestDraft,
  scopes: readonly VariableScope[],
  options: { now?: number } = {},
): PreparedRequest {
  const missing = new Set<string>();
  const warnings: string[] = [];
  const v = (text: string) => {
    const r = interpolate(text, scopes, options);
    for (const m of r.missing) missing.add(m);
    return r.text;
  };

  const rawUrl = v(d.url).trim();
  if (!rawUrl) throw new ValidationError('Enter a URL.');
  let url: URL;
  try {
    url = new URL(withScheme(rawUrl));
  } catch {
    throw new ValidationError(
      missing.size
        ? `The URL is not valid; these variables have no value: ${[...missing].join(', ')}.`
        : `"${rawUrl}" is not a valid URL.`,
    );
  }
  if (/[{}]/.test(decodeURIComponent(url.host)))
    throw new ValidationError(
      `The server address uses variables without a value: ${[...missing].join(', ') || url.host}. Choose an environment that defines them.`,
    );
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new ValidationError(`Only http and https URLs can be requested (got ${url.protocol}).`);
  for (const p of d.params)
    if (p.enabled && p.key.trim()) url.searchParams.append(v(p.key), v(p.value));

  const headers: [string, string][] = [];
  const has = (name: string) => headers.some(([k]) => k.toLowerCase() === name.toLowerCase());
  const add = (name: string, value: string) => {
    if (!TOKEN.test(name)) throw new ValidationError(`"${name}" is not a valid header name.`);
    if (/[\r\n]/.test(value))
      throw new ValidationError(`The value of header "${name}" contains a line break.`);
    if (isForbiddenHeader(name)) {
      warnings.push(`Browsers do not let pages set the "${name}" header; it is not sent.`);
      return;
    }
    headers.push([name, value]);
  };
  for (const h of d.headers) if (h.enabled && h.key.trim()) add(v(h.key).trim(), v(h.value));

  const a = d.auth;
  if (a.type === 'basic' && !has('authorization'))
    add('Authorization', `Basic ${utf8Base64(`${v(a.username)}:${v(a.password)}`)}`);
  if (a.type === 'bearer' && !has('authorization')) {
    const token = v(a.token).trim();
    if (!token) warnings.push('Bearer authentication is selected but the token is empty.');
    else add('Authorization', `${v(a.prefix).trim()} ${token}`.trim());
  }
  if (a.type === 'apikey' && a.apiKeyName.trim()) {
    if (a.apiKeyIn === 'query') url.searchParams.append(v(a.apiKeyName), v(a.apiKeyValue));
    else if (!has(a.apiKeyName)) add(v(a.apiKeyName).trim(), v(a.apiKeyValue));
  }
  if (a.type === 'oauth2' && !has('authorization')) {
    if (a.oauth2.accessToken) add('Authorization', `Bearer ${a.oauth2.accessToken}`);
    else warnings.push('OAuth 2.0 is selected but no access token was obtained yet.');
  }

  let body: PreparedBody = { kind: 'none' };
  const b = d.body;
  const contentType = (value: string) => {
    if (!has('content-type')) headers.push(['Content-Type', value]);
  };
  if (b.mode !== 'none' && (d.method === 'GET' || d.method === 'HEAD'))
    throw new ValidationError(
      `${d.method} requests cannot have a body in browsers. Choose "No body" or another method.`,
    );
  switch (b.mode) {
    case 'none':
      break;
    case 'json': {
      const text = v(b.raw);
      if (text.trim() && !tryParseJson(text).ok) warnings.push('The body is not valid JSON.');
      body = { kind: 'text', text };
      contentType('application/json');
      break;
    }
    case 'text':
      body = { kind: 'text', text: v(b.raw) };
      contentType('text/plain;charset=UTF-8');
      break;
    case 'xml':
      body = { kind: 'text', text: v(b.raw) };
      contentType('application/xml');
      break;
    case 'form-urlencoded': {
      const form = new URLSearchParams();
      for (const f of b.form) if (f.enabled && f.key.trim()) form.append(v(f.key), v(f.value));
      body = { kind: 'text', text: form.toString() };
      contentType('application/x-www-form-urlencoded');
      break;
    }
    case 'form-data': {
      const i = headers.findIndex(([k]) => k.toLowerCase() === 'content-type');
      if (i >= 0) {
        headers.splice(i, 1);
        warnings.push(
          'Content-Type is set by the browser for form data (it includes the boundary); your value was not sent.',
        );
      }
      body = {
        kind: 'form-data',
        fields: b.formData
          .filter((f) => f.enabled && f.key.trim())
          .map((f) => ({
            key: v(f.key),
            value: f.type === 'file' ? f.value : v(f.value),
            fileEntryId: f.type === 'file' ? f.id : null,
          })),
      };
      break;
    }
    case 'graphql': {
      const vars = v(b.graphql.variables).trim();
      let variables: unknown = undefined;
      if (vars) {
        const parsed = tryParseJson(vars);
        if (!parsed.ok) throw new ValidationError('The GraphQL variables are not valid JSON.');
        variables = parsed.value;
      }
      body = {
        kind: 'text',
        text: JSON.stringify({
          query: v(b.graphql.query),
          ...(variables === undefined ? {} : { variables }),
        }),
      };
      contentType('application/json');
      break;
    }
    case 'binary':
      body = { kind: 'binary' };
      break;
  }
  if (missing.size)
    warnings.unshift(`No value for ${[...missing].map((m) => `{{${m}}}`).join(', ')}.`);
  return { method: d.method, url: url.toString(), headers, body, missing: [...missing], warnings };
}
