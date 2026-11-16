import { z } from 'zod';
import { ValidationError } from '../errors/AppError';
import { safeJsonParse } from '../security/safeJsonParse';
import {
  emptyRequest,
  type FormDataEntry,
  HTTP_METHODS,
  type KeyValue,
  keyValueSchema,
  parseRequestDraft,
  type RequestAuth,
  type RequestDraft,
  rowId,
  withoutCredentials,
} from './model';

/** A collection in a storage-independent shape (import/export). Folder ids are local to the bundle. */
export interface CollectionBundle {
  name: string;
  description: string;
  variables: KeyValue[];
  folders: { id: string; name: string; parentId: string | null }[];
  requests: { folderId: string | null; draft: RequestDraft }[];
}

export interface ImportResult {
  bundle: CollectionBundle;
  format: 'devstudio' | 'postman';
  warnings: string[];
}

export const NATIVE_FORMAT = 'devstudio.api-collection';
export const MAX_IMPORT_REQUESTS = 5000;
const MAX_FOLDER_DEPTH = 32;

const nativeSchema = z.object({
  format: z.literal(NATIVE_FORMAT),
  version: z.literal(1),
  collection: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(100_000).catch(''),
    variables: z.array(keyValueSchema).max(1000).catch([]),
    folders: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          name: z.string().min(1).max(200),
          parentId: z.string().max(64).nullable(),
        }),
      )
      .max(5000),
  }),
  requests: z
    .array(z.object({ folderId: z.string().max(64).nullable(), request: z.unknown() }))
    .max(MAX_IMPORT_REQUESTS),
});

/** DevStudio's own format. Credentials are never exported (only {{variable}} references). */
export function exportNative(bundle: CollectionBundle, exportedAt = new Date()): string {
  return JSON.stringify(
    {
      format: NATIVE_FORMAT,
      version: 1,
      exportedAt: exportedAt.toISOString(),
      collection: {
        name: bundle.name,
        description: bundle.description,
        variables: bundle.variables,
        folders: bundle.folders,
      },
      requests: bundle.requests.map((r) => ({
        folderId: r.folderId,
        request: withoutCredentials(r.draft),
      })),
    },
    null,
    2,
  );
}

function importNative(value: unknown): ImportResult {
  const parsed = nativeSchema.safeParse(value);
  if (!parsed.success)
    throw new ValidationError(
      `This is not a valid DevStudio collection: ${parsed.error.issues[0]?.message ?? 'invalid'}.`,
    );
  const { collection, requests } = parsed.data;
  const folderIds = new Set(collection.folders.map((f) => f.id));
  const warnings: string[] = [];
  const folders = collection.folders.map((f) => ({
    ...f,
    parentId: f.parentId && folderIds.has(f.parentId) && f.parentId !== f.id ? f.parentId : null,
  }));
  breakCycles(folders);
  const out: CollectionBundle['requests'] = [];
  requests.forEach((r, i) => {
    try {
      out.push({
        folderId: r.folderId && folderIds.has(r.folderId) ? r.folderId : null,
        draft: parseRequestDraft(r.request),
      });
    } catch {
      warnings.push(`Request ${String(i + 1)} is invalid and was skipped.`);
    }
  });
  return {
    format: 'devstudio',
    warnings,
    bundle: {
      name: collection.name,
      description: collection.description,
      variables: collection.variables,
      folders,
      requests: out,
    },
  };
}

/** Folders whose parent chain loops are moved to the root. */
function breakCycles(folders: { id: string; parentId: string | null }[]): void {
  const byId = new Map(folders.map((f) => [f.id, f]));
  for (const f of folders) {
    const seen = new Set<string>([f.id]);
    let p = f.parentId ? byId.get(f.parentId) : undefined;
    let depth = 0;
    while (p) {
      if (seen.has(p.id) || ++depth > MAX_FOLDER_DEPTH) {
        f.parentId = null;
        break;
      }
      seen.add(p.id);
      p = p.parentId ? byId.get(p.parentId) : undefined;
    }
  }
}

// ---------------------------------------------------------------- Postman v2.0/v2.1

const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, max = 100_000): string =>
  (typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : ''
  ).slice(0, max);

function postmanPairs(v: unknown): KeyValue[] {
  return arr(v)
    .map(obj)
    .filter((p) => str(p.key) !== '' || str(p.value) !== '')
    .slice(0, 500)
    .map((p) => ({
      id: rowId(),
      key: str(p.key, 1000),
      value: str(p.value),
      enabled: p.disabled !== true,
    }));
}

/** Postman auth: `{type, basic: [{key, value}]}` (v2.1) or `{type, basic: {username}}` (v2.0). */
function postmanAuth(v: unknown, warnings: Set<string>): RequestAuth | null {
  const a = obj(v);
  const type = str(a.type);
  if (!type) return null;
  const params = (section: unknown): Record<string, string> => {
    if (Array.isArray(section))
      return Object.fromEntries(section.map(obj).map((p) => [str(p.key), str(p.value)]));
    return Object.fromEntries(Object.entries(obj(section)).map(([k, val]) => [k, str(val)]));
  };
  const base = emptyRequest().auth;
  switch (type) {
    case 'noauth':
      return base;
    case 'basic': {
      const p = params(a.basic);
      return { ...base, type: 'basic', username: p.username ?? '', password: p.password ?? '' };
    }
    case 'bearer': {
      const p = params(a.bearer);
      return { ...base, type: 'bearer', token: p.token ?? '' };
    }
    case 'apikey': {
      const p = params(a.apikey);
      return {
        ...base,
        type: 'apikey',
        apiKeyName: p.key ?? 'X-API-Key',
        apiKeyValue: p.value ?? '',
        apiKeyIn: p.in === 'query' ? 'query' : 'header',
      };
    }
    case 'oauth2': {
      const p = params(a.oauth2);
      const grant =
        p.grant_type === 'authorization_code_with_pkce' || p.grant_type === 'authorization_code'
          ? 'authorization_code'
          : 'client_credentials';
      if (
        p.grant_type &&
        !['client_credentials', 'authorization_code', 'authorization_code_with_pkce'].includes(
          p.grant_type,
        )
      )
        warnings.add(
          `OAuth 2.0 grant "${p.grant_type}" is not supported; it was imported as client credentials.`,
        );
      return {
        ...base,
        type: 'oauth2',
        oauth2: {
          ...base.oauth2,
          grant,
          tokenUrl: p.accessTokenUrl ?? '',
          authUrl: p.authUrl ?? '',
          clientId: p.clientId ?? '',
          clientSecret: p.clientSecret ?? '',
          scope: p.scope ?? '',
        },
      };
    }
    default:
      warnings.add(
        `"${type}" authentication is not supported; those requests were imported without auth.`,
      );
      return base;
  }
}

function postmanUrl(v: unknown): string {
  if (typeof v === 'string') return v;
  const u = obj(v);
  if (typeof u.raw === 'string') return u.raw;
  const host = Array.isArray(u.host) ? u.host.map((h) => str(h)).join('.') : str(u.host);
  const path = Array.isArray(u.path) ? u.path.map((p) => str(p)).join('/') : str(u.path);
  const protocol = str(u.protocol);
  const query = postmanPairs(u.query).filter((q) => q.enabled);
  return `${protocol ? `${protocol}://` : ''}${host}${path ? `/${path}` : ''}${query.length ? `?${query.map((q) => `${q.key}=${q.value}`).join('&')}` : ''}`;
}

function postmanBody(v: unknown, warnings: Set<string>): RequestDraft['body'] {
  const body = emptyRequest().body;
  const b = obj(v);
  switch (str(b.mode)) {
    case 'raw': {
      const lang = str(obj(obj(b.options).raw).language);
      const mode = lang === 'json' ? 'json' : lang === 'xml' ? 'xml' : 'text';
      return { ...body, mode, raw: str(b.raw, 20_000_000) };
    }
    case 'urlencoded':
      return { ...body, mode: 'form-urlencoded', form: postmanPairs(b.urlencoded) };
    case 'formdata': {
      const formData: FormDataEntry[] = arr(b.formdata)
        .map(obj)
        .slice(0, 500)
        .map((p) => {
          const file = str(p.type) === 'file';
          if (file)
            warnings.add(
              'Files of multipart bodies are not part of the collection; choose them again before sending.',
            );
          const src = Array.isArray(p.src) ? str(p.src[0]) : str(p.src);
          return {
            id: rowId(),
            key: str(p.key, 1000),
            value: file ? (src.split(/[\\/]/).pop() ?? '') : str(p.value),
            type: file ? 'file' : 'text',
            enabled: p.disabled !== true,
          };
        });
      return { ...body, mode: 'form-data', formData };
    }
    case 'graphql': {
      const g = obj(b.graphql);
      return {
        ...body,
        mode: 'graphql',
        graphql: { query: str(g.query, 1_000_000), variables: str(g.variables, 1_000_000) },
      };
    }
    case 'file':
      warnings.add(
        'Binary file bodies are not part of the collection; choose the file again before sending.',
      );
      return { ...body, mode: 'binary' };
    default:
      return body;
  }
}

function importPostman(root: Record<string, unknown>): ImportResult {
  const info = obj(root.info);
  const warnings = new Set<string>();
  const folders: CollectionBundle['folders'] = [];
  const requests: CollectionBundle['requests'] = [];
  let scripts = 0;
  const countScripts = (item: Record<string, unknown>) => {
    if (arr(item.event).some((e) => arr(obj(obj(e).script).exec).some((line) => str(line).trim())))
      scripts++;
  };
  countScripts(root);

  const walk = (
    items: unknown,
    parentId: string | null,
    inherited: RequestAuth | null,
    depth: number,
  ) => {
    if (depth > MAX_FOLDER_DEPTH) {
      warnings.add('Folders nested deeper than 32 levels were skipped.');
      return;
    }
    for (const raw of arr(items)) {
      const item = obj(raw);
      countScripts(item);
      if (Array.isArray(item.item)) {
        const id = rowId();
        folders.push({ id, name: str(item.name, 200).trim() || 'Folder', parentId });
        walk(item.item, id, postmanAuth(item.auth, warnings) ?? inherited, depth + 1);
        continue;
      }
      if (requests.length >= MAX_IMPORT_REQUESTS) {
        warnings.add(`Only the first ${String(MAX_IMPORT_REQUESTS)} requests were imported.`);
        return;
      }
      const r = typeof item.request === 'string' ? { url: item.request } : obj(item.request);
      const method = str(r.method).toUpperCase() || 'GET';
      const known = HTTP_METHODS.find((m) => m === method);
      if (!known) warnings.add(`Method ${method} is not supported; those requests use GET.`);
      const draft = emptyRequest({
        name: str(item.name, 200).trim() || 'Request',
        method: known ?? 'GET',
        url: postmanUrl(r.url),
        headers: postmanPairs(r.header),
        body: postmanBody(r.body, warnings),
        auth: postmanAuth(r.auth, warnings) ?? inherited ?? emptyRequest().auth,
      });
      try {
        requests.push({ folderId: parentId, draft: parseRequestDraft(draft) });
      } catch {
        warnings.add('Some requests were too large or invalid and were skipped.');
      }
    }
  };
  walk(root.item, null, postmanAuth(root.auth, warnings), 0);
  if (scripts > 0)
    warnings.add(
      `${String(scripts)} pre-request/test script(s) were ignored: DevStudio never runs imported code. Use assertions instead.`,
    );
  const variables = postmanPairs(root.variable).slice(0, 1000);
  return {
    format: 'postman',
    warnings: [...warnings],
    bundle: {
      name: str(info.name, 200).trim() || 'Imported collection',
      description:
        typeof info.description === 'string'
          ? info.description.slice(0, 100_000)
          : str(obj(info.description).content, 100_000),
      variables,
      folders,
      requests,
    },
  };
}

/** Reads a DevStudio or Postman (v2.0/v2.1) collection file. */
export function importCollection(text: string): ImportResult {
  let value: unknown;
  try {
    value = safeJsonParse(text);
  } catch {
    throw new ValidationError('The file is not valid JSON.');
  }
  const root = obj(value);
  if (root.format === NATIVE_FORMAT) return importNative(value);
  const schema = str(obj(root.info).schema);
  if (schema.includes('getpostman.com') || schema.includes('postman')) {
    if (!/v2\.[01]/.test(schema))
      throw new ValidationError('Only Postman collection format v2.0 and v2.1 can be imported.');
    return importPostman(root);
  }
  throw new ValidationError(
    'Unknown file: expected a DevStudio collection or a Postman v2.1 collection export.',
  );
}

// ---------------------------------------------------------------- Postman export

function pairs(rows: readonly KeyValue[]) {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => ({ key: r.key, value: r.value, ...(r.enabled ? {} : { disabled: true }) }));
}

function postmanAuthOut(a: RequestAuth): Record<string, unknown> | undefined {
  const kv = (o: Record<string, string>) =>
    Object.entries(o).map(([key, value]) => ({ key, value, type: 'string' }));
  switch (a.type) {
    case 'basic':
      return { type: 'basic', basic: kv({ username: a.username, password: a.password }) };
    case 'bearer':
      return { type: 'bearer', bearer: kv({ token: a.token }) };
    case 'apikey':
      return {
        type: 'apikey',
        apikey: kv({ key: a.apiKeyName, value: a.apiKeyValue, in: a.apiKeyIn }),
      };
    case 'oauth2':
      return {
        type: 'oauth2',
        oauth2: kv({
          grant_type:
            a.oauth2.grant === 'authorization_code'
              ? 'authorization_code_with_pkce'
              : 'client_credentials',
          accessTokenUrl: a.oauth2.tokenUrl,
          authUrl: a.oauth2.authUrl,
          clientId: a.oauth2.clientId,
          clientSecret: a.oauth2.clientSecret,
          scope: a.oauth2.scope,
        }),
      };
    default:
      return undefined;
  }
}

function postmanBodyOut(d: RequestDraft): Record<string, unknown> | undefined {
  const b = d.body;
  switch (b.mode) {
    case 'json':
    case 'xml':
    case 'text':
      return { mode: 'raw', raw: b.raw, options: { raw: { language: b.mode } } };
    case 'form-urlencoded':
      return { mode: 'urlencoded', urlencoded: pairs(b.form) };
    case 'form-data':
      return {
        mode: 'formdata',
        formdata: b.formData
          .filter((f) => f.key.trim())
          .map((f) =>
            f.type === 'file'
              ? { key: f.key, type: 'file', src: f.value }
              : { key: f.key, value: f.value, type: 'text' },
          ),
      };
    case 'graphql':
      return {
        mode: 'graphql',
        graphql: { query: b.graphql.query, variables: b.graphql.variables },
      };
    case 'binary':
      return { mode: 'file', file: {} };
    default:
      return undefined;
  }
}

/** Postman collection v2.1 (credentials removed). Assertions and extractions are DevStudio-only. */
export function exportPostman(bundle: CollectionBundle): string {
  const requestItem = (draft: RequestDraft) => {
    const d = withoutCredentials(draft);
    const auth = postmanAuthOut(d.auth);
    const body = postmanBodyOut(d);
    const query = pairs(d.params);
    const raw = query.length
      ? `${d.url}${d.url.includes('?') ? '&' : '?'}${query
          .filter((q) => !q.disabled)
          .map((q) => `${q.key}=${q.value}`)
          .join('&')}`
      : d.url;
    return {
      name: d.name,
      request: {
        method: d.method,
        header: pairs(d.headers),
        url: { raw },
        ...(auth ? { auth } : {}),
        ...(body ? { body } : {}),
      },
    };
  };
  const items = (parentId: string | null): unknown[] => [
    ...bundle.folders
      .filter((f) => f.parentId === parentId)
      .map((f) => ({ name: f.name, item: items(f.id) })),
    ...bundle.requests.filter((r) => r.folderId === parentId).map((r) => requestItem(r.draft)),
  ];
  return JSON.stringify(
    {
      info: {
        name: bundle.name,
        description: bundle.description,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: items(null),
      variable: pairs(bundle.variables).map(({ key, value }) => ({ key, value })),
    },
    null,
    2,
  );
}
