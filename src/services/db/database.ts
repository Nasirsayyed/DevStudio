import Dexie, { type EntityTable } from 'dexie';
import type {
  ApiHistoryEntity,
  ApiRequestEntity,
  CodeSnippetEntity,
  CollectionEntity,
  EnvironmentEntity,
  FavoriteEntity,
  JsonDocumentEntity,
  SavedQueryEntity,
  SettingEntity,
  ToolHistoryEntity,
  ToolUsageEntity,
} from '@/types/entities';

export const DATABASE_NAME = 'devstudio';

/**
 * Schema history. NEVER edit a published version — add a new one with an
 * `.upgrade()` migration instead. See docs/DATABASE_SCHEMA.md.
 */
export const SCHEMA_V1 = {
  collections: 'id, name, updatedAt',
  apiRequests: 'id, collectionId, folderId, name, method, updatedAt, [collectionId+folderId]',
  environments: 'id, &name, updatedAt',
  apiHistory: 'id, requestId, method, status, createdAt, url',
  jsonDocuments: 'id, name, *tags, updatedAt',
  savedQueries: 'id, name, dialect, kind, *tags, updatedAt',
  codeSnippets: 'id, title, language, category, *tags, isFavorite, updatedAt',
  favorites: 'id, &[entityType+entityId], entityType, createdAt',
  toolHistory: 'id, toolId, createdAt, [toolId+createdAt]',
  settings: 'key',
  toolUsage: 'toolId, count, lastUsedAt',
} as const;

export const CURRENT_SCHEMA_VERSION = 1;

export class DevStudioDatabase extends Dexie {
  collections!: EntityTable<CollectionEntity, 'id'>;
  apiRequests!: EntityTable<ApiRequestEntity, 'id'>;
  environments!: EntityTable<EnvironmentEntity, 'id'>;
  apiHistory!: EntityTable<ApiHistoryEntity, 'id'>;
  jsonDocuments!: EntityTable<JsonDocumentEntity, 'id'>;
  savedQueries!: EntityTable<SavedQueryEntity, 'id'>;
  codeSnippets!: EntityTable<CodeSnippetEntity, 'id'>;
  favorites!: EntityTable<FavoriteEntity, 'id'>;
  toolHistory!: EntityTable<ToolHistoryEntity, 'id'>;
  settings!: EntityTable<SettingEntity, 'key'>;
  toolUsage!: EntityTable<ToolUsageEntity, 'toolId'>;

  constructor(name = DATABASE_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    // Future migrations go here, e.g.:
    // this.version(2).stores({ ...SCHEMA_V1, codeSnippets: '..., newIndex' })
    //   .upgrade((tx) => tx.table('codeSnippets').toCollection().modify((s) => { ... }));
  }
}

/** Application-wide database instance. Tests use fake-indexeddb (see src/test/setup.ts). */
export const db = new DevStudioDatabase();

export type TableName = keyof typeof SCHEMA_V1;
export const TABLE_NAMES = Object.keys(SCHEMA_V1) as TableName[];
