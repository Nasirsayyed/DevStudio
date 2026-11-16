import { z } from 'zod';
import type { HttpMethod } from '@/types/entities';

/** API Studio request model (stored in `apiRequests.config`, validated on load and import). */

export const HTTP_METHODS: readonly HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

export const keyValueSchema = z.object({
  id: z.string().min(1).max(64),
  key: z.string().max(1000),
  value: z.string().max(100_000),
  enabled: z.boolean(),
  description: z.string().max(1000).optional(),
});
export type KeyValue = z.infer<typeof keyValueSchema>;

export const BODY_MODES = [
  'none',
  'json',
  'text',
  'xml',
  'form-urlencoded',
  'form-data',
  'graphql',
  'binary',
] as const;
export type BodyMode = (typeof BODY_MODES)[number];

const formDataEntrySchema = z.object({
  id: z.string().min(1).max(64),
  key: z.string().max(1000),
  /** Text value; for files, the file name of the last chosen file (files are never stored). */
  value: z.string().max(100_000),
  type: z.enum(['text', 'file']),
  enabled: z.boolean(),
});
export type FormDataEntry = z.infer<typeof formDataEntrySchema>;

export const bodySchema = z.object({
  mode: z.enum(BODY_MODES),
  raw: z.string().max(20_000_000),
  form: z.array(keyValueSchema).max(500),
  formData: z.array(formDataEntrySchema).max(500),
  graphql: z.object({ query: z.string().max(1_000_000), variables: z.string().max(1_000_000) }),
});
export type RequestBody = z.infer<typeof bodySchema>;

export const AUTH_TYPES = ['none', 'basic', 'bearer', 'apikey', 'oauth2'] as const;
export const authSchema = z.object({
  type: z.enum(AUTH_TYPES),
  username: z.string().max(10_000),
  password: z.string().max(10_000),
  token: z.string().max(100_000),
  /** Bearer prefix (usually "Bearer"). */
  prefix: z.string().max(100),
  apiKeyName: z.string().max(1000),
  apiKeyValue: z.string().max(100_000),
  apiKeyIn: z.enum(['header', 'query']),
  oauth2: z.object({
    grant: z.enum(['client_credentials', 'authorization_code']),
    tokenUrl: z.string().max(4000),
    authUrl: z.string().max(4000),
    clientId: z.string().max(1000),
    clientSecret: z.string().max(10_000),
    scope: z.string().max(4000),
    /** Last token obtained (memory only; stripped before saving). */
    accessToken: z.string().max(100_000),
  }),
});
export type RequestAuth = z.infer<typeof authSchema>;

export const ASSERTION_KINDS = [
  'status-equals',
  'status-in-range',
  'json-equals',
  'json-exists',
  'json-contains',
  'header-contains',
  'body-contains',
  'time-below',
] as const;
export const assertionSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(ASSERTION_KINDS),
  /** JSONPath, header name, or unused. */
  target: z.string().max(1000),
  /** Expected value (JSON for json-equals, text otherwise). */
  expected: z.string().max(100_000),
  enabled: z.boolean(),
});
export type Assertion = z.infer<typeof assertionSchema>;

export const extractionSchema = z.object({
  id: z.string().min(1).max(64),
  /** Variable to set for the following requests. */
  variable: z.string().max(200),
  source: z.enum(['json', 'header', 'status']),
  /** JSONPath or header name. */
  path: z.string().max(1000),
  enabled: z.boolean(),
});
export type Extraction = z.infer<typeof extractionSchema>;

export const settingsSchema = z.object({
  timeoutMs: z.number().int().min(0).max(600_000),
  /** fetch `redirect`: follow, or report 3xx responses as they are (opaque in browsers). */
  followRedirects: z.boolean(),
  /** Send cookies of the target site (fetch `credentials: 'include'`). */
  includeCredentials: z.boolean(),
});

export const requestDraftSchema = z.object({
  name: z.string().max(200),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  url: z.string().max(100_000),
  params: z.array(keyValueSchema).max(500),
  headers: z.array(keyValueSchema).max(500),
  body: bodySchema,
  auth: authSchema,
  settings: settingsSchema,
  assertions: z.array(assertionSchema).max(200),
  extract: z.array(extractionSchema).max(200),
});
export type RequestDraft = z.infer<typeof requestDraftSchema>;

let counter = 0;
/** Ids for list rows (stable keys); uniqueness within a request is enough. */
export function rowId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function emptyRow(): KeyValue {
  return { id: rowId(), key: '', value: '', enabled: true };
}

export const EMPTY_AUTH: RequestAuth = {
  type: 'none',
  username: '',
  password: '',
  token: '',
  prefix: 'Bearer',
  apiKeyName: 'X-API-Key',
  apiKeyValue: '',
  apiKeyIn: 'header',
  oauth2: {
    grant: 'client_credentials',
    tokenUrl: '',
    authUrl: '',
    clientId: '',
    clientSecret: '',
    scope: '',
    accessToken: '',
  },
};

export function emptyRequest(patch: Partial<RequestDraft> = {}): RequestDraft {
  return {
    name: 'New request',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: { mode: 'none', raw: '', form: [], formData: [], graphql: { query: '', variables: '' } },
    auth: EMPTY_AUTH,
    settings: { timeoutMs: 30_000, followRedirects: true, includeCredentials: false },
    assertions: [],
    extract: [],
    ...patch,
  };
}

/** Reads a stored/imported request, filling defaults for fields added later. */
export function parseRequestDraft(value: unknown): RequestDraft {
  const base = emptyRequest();
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const merged = {
    ...base,
    ...v,
    body: { ...base.body, ...(v.body as object | undefined) },
    auth: {
      ...base.auth,
      ...(v.auth as object | undefined),
      oauth2: {
        ...base.auth.oauth2,
        ...((v.auth as { oauth2?: object } | undefined)?.oauth2 ?? {}),
      },
    },
    settings: { ...base.settings, ...(v.settings as object | undefined) },
  };
  return requestDraftSchema.parse(merged);
}

/** Credential fields of a request (never written to history; saved only with consent). */
export function hasLiteralCredentials(auth: RequestAuth): boolean {
  const literal = (s: string) => s.trim() !== '' && !/^\{\{[^}]+\}\}$/.test(s.trim());
  switch (auth.type) {
    case 'basic':
      return literal(auth.password);
    case 'bearer':
      return literal(auth.token);
    case 'apikey':
      return literal(auth.apiKeyValue);
    case 'oauth2':
      return literal(auth.oauth2.clientSecret);
    default:
      return false;
  }
}

/** Removes credential values that are not {{variable}} references, and any obtained OAuth token. */
export function withoutCredentials(d: RequestDraft): RequestDraft {
  const keep = (s: string) => (/^\s*\{\{[^}]+\}\}\s*$/.test(s) ? s : '');
  return {
    ...d,
    auth: {
      ...d.auth,
      password: keep(d.auth.password),
      token: keep(d.auth.token),
      apiKeyValue: keep(d.auth.apiKeyValue),
      oauth2: { ...d.auth.oauth2, clientSecret: keep(d.auth.oauth2.clientSecret), accessToken: '' },
    },
  };
}
