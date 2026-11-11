/**
 * Persisted entity types (IndexedDB). See docs/DATABASE_SCHEMA.md.
 * All primary keys are UUID v7 strings (time-sortable) unless noted.
 */
export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValueEntry {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface CollectionFolder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface CollectionEntity extends BaseEntity {
  name: string;
  description: string;
  folders: CollectionFolder[];
  variables: KeyValueEntry[];
}

/** Request shape is finalized in Phase 10; only fields needed for listing/search are fixed here. */
export interface ApiRequestEntity extends BaseEntity {
  collectionId: string | null;
  folderId: string | null;
  name: string;
  method: HttpMethod;
  url: string;
  /** Remaining request configuration (params, headers, auth, body, assertions...). */
  config: Record<string, unknown>;
}

export interface EnvironmentVariable extends KeyValueEntry {
  secret: boolean;
}

export interface EnvironmentEntity extends BaseEntity {
  name: string;
  variables: EnvironmentVariable[];
  isBuiltIn: boolean;
  /** User consent to persist secret values on this device. */
  persistSecrets: boolean;
}

export interface ApiHistoryEntity {
  id: string;
  createdAt: number;
  requestId: string | null;
  method: HttpMethod;
  url: string;
  status: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  /** Request/response snapshot; bodies truncated before storage. */
  snapshot: Record<string, unknown>;
}

export interface JsonDocumentEntity extends BaseEntity {
  name: string;
  content: string;
  sizeBytes: number;
  tags: string[];
}

export type SqlDialect = 'mssql' | 'postgresql' | 'mysql' | 'sqlite';
export type SavedQueryKind = 'query' | 'schema' | 'sqliteDb';

export interface SavedQueryEntity extends BaseEntity {
  name: string;
  dialect: SqlDialect;
  kind: SavedQueryKind;
  tags: string[];
  /** SQL text, schema-designer JSON, or (kind = sqliteDb) a SQLite database file. */
  content: string | Uint8Array;
}

export interface CodeSnippetEntity extends BaseEntity {
  title: string;
  description: string;
  code: string;
  language: string;
  category: string;
  tags: string[];
  /** Stored as 0/1 because IndexedDB cannot index booleans. */
  isFavorite: 0 | 1;
}

export type FavoriteEntityType = 'tool' | 'request' | 'snippet' | 'document' | 'query';

export interface FavoriteEntity {
  id: string;
  entityType: FavoriteEntityType;
  entityId: string;
  createdAt: number;
  order: number;
}

export interface ToolHistoryEntity {
  id: string;
  toolId: string;
  createdAt: number;
  label: string;
  input: string;
  output: string;
  options: Record<string, unknown>;
  durationMs: number | null;
}

export interface SettingEntity {
  /** Primary key. */
  key: string;
  value: unknown;
  updatedAt: number;
}

export interface ToolUsageEntity {
  /** Primary key. */
  toolId: string;
  count: number;
  lastUsedAt: number;
}
