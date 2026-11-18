import { z } from 'zod';
import { ValidationError } from '../errors/AppError';
import { parseRequestDraft, withoutCredentials } from '../http/model';
import { safeJsonParse } from '../security/safeJsonParse';

/** DevStudio backup file: every IndexedDB table plus preferences, as JSON. */
export const BACKUP_FORMAT = 'devstudio.backup';
export const BACKUP_VERSION = 1;

export const BACKUP_SECTIONS = {
  /** Saved work. */
  work: [
    'collections',
    'apiRequests',
    'environments',
    'jsonDocuments',
    'savedQueries',
    'codeSnippets',
    'favorites',
  ],
  /** Tool and API request history. */
  history: ['toolHistory', 'apiHistory'],
  /** Structured settings (dashboard, drafts) and usage statistics. */
  settings: ['settings', 'toolUsage'],
} as const;

export type BackupSection = keyof typeof BACKUP_SECTIONS;
export type BackupTable = (typeof BACKUP_SECTIONS)[BackupSection][number];
export const BACKUP_TABLES: readonly BackupTable[] = Object.values(BACKUP_SECTIONS).flat();

export const SECTION_LABELS: Record<BackupSection, string> = {
  work: 'Saved work (collections, requests, environments, documents, queries, snippets, favorites)',
  history: 'History (tool runs and API requests)',
  settings: 'Settings, drafts, usage statistics and preferences',
};

export interface BackupData {
  tables: Partial<Record<BackupTable, unknown[]>>;
  /** Preferences from localStorage (theme, editor…), when the settings section is included. */
  preferences: unknown;
}

// ------------------------------------------------------------------ row schemas

const id = z.string().min(1).max(200);
const time = z.number();
const text = (max: number) => z.string().max(max);
const record = z.record(z.string(), z.unknown());
const base = { id, createdAt: time, updatedAt: time };
const keyValue = z.object({
  id: text(200),
  key: text(1000),
  value: text(1_000_000),
  enabled: z.boolean(),
  description: text(10_000).optional(),
});
const method = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

const BYTES_KEY = '$devstudioBytes';
const bytesSchema = z.object({ [BYTES_KEY]: z.string().max(400_000_000) });

const ROW_SCHEMAS: Record<BackupTable, z.ZodType> = {
  collections: z.object({
    ...base,
    name: text(200),
    description: text(100_000),
    folders: z.array(z.object({ id, name: text(200), parentId: id.nullable() })).max(10_000),
    variables: z.array(keyValue).max(5000),
    runOrder: z.array(id).max(20_000).optional(),
  }),
  apiRequests: z.object({
    ...base,
    collectionId: id.nullable(),
    folderId: id.nullable(),
    name: text(200),
    method,
    url: text(100_000),
    config: record,
  }),
  environments: z.object({
    ...base,
    name: text(100),
    variables: z.array(keyValue.extend({ secret: z.boolean() })).max(5000),
    isBuiltIn: z.boolean(),
    persistSecrets: z.boolean(),
  }),
  jsonDocuments: z.object({
    ...base,
    name: text(200),
    content: text(200_000_000),
    sizeBytes: z.number().nonnegative(),
    tags: z.array(text(100)).max(100),
  }),
  savedQueries: z.object({
    ...base,
    name: text(200),
    dialect: z.enum(['mssql', 'postgresql', 'mysql', 'sqlite']),
    kind: z.enum(['query', 'schema', 'sqliteDb']),
    tags: z.array(text(100)).max(100),
    content: z.union([text(200_000_000), bytesSchema]),
    sizeBytes: z.number().nonnegative().optional(),
  }),
  codeSnippets: z.object({
    ...base,
    title: text(200),
    description: text(10_000),
    code: text(5_000_000),
    language: text(100),
    category: text(100),
    tags: z.array(text(100)).max(100),
    isFavorite: z.union([z.literal(0), z.literal(1)]),
  }),
  favorites: z.object({
    id,
    entityType: z.enum(['tool', 'request', 'snippet', 'document', 'query']),
    entityId: id,
    createdAt: time,
    order: z.number(),
  }),
  toolHistory: z.object({
    id,
    toolId: text(200),
    createdAt: time,
    label: text(200),
    input: text(2_000_000),
    output: text(2_000_000),
    options: record,
    durationMs: z.number().nullable(),
  }),
  apiHistory: z.object({
    id,
    createdAt: time,
    requestId: id.nullable(),
    method,
    url: text(100_000),
    status: z.number().int().nullable(),
    durationMs: z.number().nullable(),
    sizeBytes: z.number().nullable(),
    snapshot: record,
  }),
  settings: z.object({ key: text(200).min(1), value: z.unknown(), updatedAt: time }),
  toolUsage: z.object({
    toolId: text(200).min(1),
    count: z.number().int().nonnegative(),
    lastUsedAt: time,
  }),
};

// ------------------------------------------------------------------ binary values

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Works for Uint8Arrays from other realms too (IndexedDB in tests). */
function isBytes(v: unknown): v is Uint8Array {
  return ArrayBuffer.isView(v) && !(v instanceof DataView);
}

// ------------------------------------------------------------------ export

export interface CreateBackupOptions {
  sections: readonly BackupSection[];
  /**
   * Keep credentials saved with requests (with the user's earlier consent) and stored secret
   * environment values. Off by default: the file is then safe to share.
   */
  includeSecrets: boolean;
  appVersion: string;
  schemaVersion: number;
  now?: Date;
}

function stripRow(table: BackupTable, row: unknown): unknown {
  const r = row as Record<string, unknown>;
  if (table === 'apiRequests') {
    try {
      const draft = withoutCredentials(
        parseRequestDraft({ ...(r.config as object), name: r.name, method: r.method, url: r.url }),
      );
      const { name: _n, method: _m, url: _u, ...config } = draft;
      return { ...r, config };
    } catch {
      return r;
    }
  }
  if (table === 'environments') {
    const variables = (r.variables as { secret?: boolean; value?: string }[] | undefined) ?? [];
    return {
      ...r,
      persistSecrets: false,
      variables: variables.map((v) => (v.secret ? { ...v, value: '' } : v)),
    };
  }
  return r;
}

/** Serializes the selected tables. Binary values are stored as base64. */
export function createBackup(data: BackupData, o: CreateBackupOptions): string {
  const tables: Record<string, unknown[]> = {};
  const wanted = new Set<BackupTable>(o.sections.flatMap((s) => BACKUP_SECTIONS[s]));
  for (const table of BACKUP_TABLES) {
    if (!wanted.has(table)) continue;
    tables[table] = (data.tables[table] ?? []).map((row) => {
      const r = o.includeSecrets ? row : stripRow(table, row);
      if (table === 'savedQueries') {
        const q = r as { content?: unknown };
        if (isBytes(q.content))
          return { ...(r as object), content: { [BYTES_KEY]: toBase64(q.content) } };
      }
      return r;
    });
  }
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: { version: o.appVersion, schemaVersion: o.schemaVersion },
    exportedAt: (o.now ?? new Date()).toISOString(),
    includesSecrets: o.includeSecrets,
    sections: o.sections,
    tables,
    ...(o.sections.includes('settings') ? { preferences: data.preferences } : {}),
  });
}

// ------------------------------------------------------------------ import

export interface ParsedBackup {
  data: BackupData;
  exportedAt: string | null;
  appVersion: string | null;
  includesSecrets: boolean;
  counts: Partial<Record<BackupTable, number>>;
  /** Rows that failed validation, per table. */
  skipped: Partial<Record<BackupTable, number>>;
  warnings: string[];
}

const envelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int(),
  app: z
    .object({ version: z.string().max(50).catch(''), schemaVersion: z.number().int().catch(1) })
    .partial()
    .catch({}),
  exportedAt: z.string().max(100).catch(''),
  includesSecrets: z.boolean().catch(false),
  tables: z.record(z.string(), z.unknown()),
  preferences: z.unknown().optional(),
});

/** Validates a backup file row by row; invalid rows are skipped and reported. */
export function parseBackup(text: string, currentSchemaVersion = 1): ParsedBackup {
  let value: unknown;
  try {
    value = safeJsonParse(text);
  } catch {
    throw new ValidationError('The file is not valid JSON.');
  }
  const envelope = envelopeSchema.safeParse(value);
  if (!envelope.success) throw new ValidationError('This is not a DevStudio backup file.');
  const e = envelope.data;
  if (e.version > BACKUP_VERSION)
    throw new ValidationError(
      'This backup was made by a newer version of DevStudio. Update DevStudio and try again.',
    );
  const warnings: string[] = [];
  if ((e.app.schemaVersion ?? 1) > currentSchemaVersion)
    warnings.push('The backup comes from a newer database schema; unknown fields are ignored.');

  const tables: Partial<Record<BackupTable, unknown[]>> = {};
  const counts: Partial<Record<BackupTable, number>> = {};
  const skipped: Partial<Record<BackupTable, number>> = {};
  for (const [name, rows] of Object.entries(e.tables)) {
    const table = BACKUP_TABLES.find((t) => t === name);
    if (!table) {
      warnings.push(`Unknown table "${name.slice(0, 50)}" was ignored.`);
      continue;
    }
    if (!Array.isArray(rows)) {
      warnings.push(`"${table}" is not a list and was ignored.`);
      continue;
    }
    const valid: unknown[] = [];
    let bad = 0;
    for (const row of rows) {
      const parsed = ROW_SCHEMAS[table].safeParse(row);
      if (!parsed.success) {
        bad++;
        continue;
      }
      let out = parsed.data as Record<string, unknown>;
      if (table === 'savedQueries' && typeof out.content === 'object' && out.content !== null) {
        try {
          out = {
            ...out,
            content: fromBase64((out.content as Record<string, string>)[BYTES_KEY] ?? ''),
          };
        } catch {
          bad++;
          continue;
        }
      }
      if (table === 'apiRequests') {
        try {
          parseRequestDraft({
            ...(out.config as object),
            name: out.name,
            method: out.method,
            url: out.url,
          });
        } catch {
          bad++;
          continue;
        }
      }
      valid.push(out);
    }
    tables[table] = valid;
    counts[table] = valid.length;
    if (bad > 0) skipped[table] = bad;
  }
  const totalSkipped = Object.values(skipped).reduce((a, b) => a + b, 0);
  if (totalSkipped > 0) warnings.push(`${String(totalSkipped)} invalid item(s) will be skipped.`);
  return {
    data: { tables, preferences: e.preferences ?? null },
    exportedAt: e.exportedAt || null,
    appVersion: e.app.version ?? null,
    includesSecrets: e.includesSecrets,
    counts,
    skipped,
    warnings,
  };
}
