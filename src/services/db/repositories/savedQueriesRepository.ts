import { NotFoundError, ValidationError } from '@/core/errors/AppError';
import { normalizeTags } from '@/core/snippets/model';
import type { SavedQueryEntity, SavedQueryKind, SqlDialect } from '@/types/entities';
import { type DevStudioDatabase, db as defaultDb } from '../database';
import { createId } from '../ids';
import { safeWrite } from '../safeWrite';

export const MAX_SAVED_QUERY_CHARS = 10_000_000;
export const MAX_SQLITE_DB_BYTES = 100 * 1024 * 1024;

export interface SaveQueryInput {
  id?: string;
  name: string;
  dialect: SqlDialect;
  kind: SavedQueryKind;
  content: string | Uint8Array;
  tags?: string[];
}

/** Saved SQL scripts, schema designs and SQLite databases. Import by path (not the barrel). */
export function createSavedQueriesRepository(db: DevStudioDatabase = defaultDb) {
  const table = db.savedQueries;
  return {
    async list(kind?: SavedQueryKind, query = ''): Promise<SavedQueryEntity[]> {
      const q = query.trim().toLowerCase();
      const all = await table.orderBy('updatedAt').reverse().toArray();
      return all.filter(
        (s) =>
          (kind === undefined || s.kind === kind) &&
          (!q ||
            s.name.toLowerCase().includes(q) ||
            s.tags.some((t) => t.toLowerCase().includes(q))),
      );
    },

    get(id: string): Promise<SavedQueryEntity | undefined> {
      return table.get(id);
    },

    async save(input: SaveQueryInput): Promise<SavedQueryEntity> {
      const name = input.name.trim();
      if (!name) throw new ValidationError('Give it a name.');
      if (name.length > 200) throw new ValidationError('Names can have at most 200 characters.');
      if (typeof input.content === 'string' && input.content.length > MAX_SAVED_QUERY_CHARS)
        throw new ValidationError('Scripts larger than 10 million characters cannot be saved.');
      if (input.content instanceof Uint8Array && input.content.byteLength > MAX_SQLITE_DB_BYTES)
        throw new ValidationError('Databases larger than 100 MB cannot be saved in the browser.');
      return safeWrite(() =>
        db.transaction('rw', table, async () => {
          const existing = input.id ? await table.get(input.id) : undefined;
          if (input.id && !existing) throw new NotFoundError('This saved item no longer exists.');
          const now = Date.now();
          const entity: SavedQueryEntity = {
            id: existing?.id ?? createId(),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            name,
            dialect: input.dialect,
            kind: input.kind,
            content: input.content,
            tags: normalizeTags(input.tags ?? existing?.tags ?? []),
          };
          await table.put(entity);
          return entity;
        }),
      );
    },

    async remove(id: string): Promise<void> {
      await safeWrite(() => table.delete(id));
    },
  };
}

export const savedQueriesRepository = createSavedQueriesRepository();
