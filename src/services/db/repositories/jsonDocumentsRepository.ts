import { ValidationError } from '@/core/errors/AppError';
import { utf8ByteLength } from '@/core/json/format';
import type { JsonDocumentEntity } from '@/types/entities';
import { type DevStudioDatabase, db as defaultDb } from '../database';
import { createId } from '../ids';
import { safeWrite } from '../safeWrite';

export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

export interface SaveJsonDocumentInput {
  /** Existing id to update; omit to create. */
  id?: string;
  name: string;
  content: string;
  tags?: string[];
}

export function createJsonDocumentsRepository(db: DevStudioDatabase = defaultDb) {
  return {
    /** Most recently updated first; optional case-insensitive name filter. */
    async list(query = '', limit = 200): Promise<JsonDocumentEntity[]> {
      const q = query.trim().toLowerCase();
      const collection = db.jsonDocuments.orderBy('updatedAt').reverse();
      const filtered = q
        ? collection.filter(
            (d) =>
              d.name.toLowerCase().includes(q) || d.tags.some((t) => t.toLowerCase().includes(q)),
          )
        : collection;
      return filtered.limit(limit).toArray();
    },

    get(id: string): Promise<JsonDocumentEntity | undefined> {
      return db.jsonDocuments.get(id);
    },

    async save(input: SaveJsonDocumentInput): Promise<JsonDocumentEntity> {
      const name = input.name.trim();
      if (!name) throw new ValidationError('Document name is required.');
      if (name.length > 200)
        throw new ValidationError('Document name must be 200 characters or fewer.');
      const sizeBytes = utf8ByteLength(input.content);
      if (sizeBytes > MAX_DOCUMENT_BYTES)
        throw new ValidationError('Documents larger than 50 MB cannot be saved.');
      const now = Date.now();
      return safeWrite(() =>
        db.transaction('rw', db.jsonDocuments, async () => {
          const existing = input.id ? await db.jsonDocuments.get(input.id) : undefined;
          const entity: JsonDocumentEntity = {
            id: existing?.id ?? createId(),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            name,
            content: input.content,
            sizeBytes,
            tags: input.tags ?? existing?.tags ?? [],
          };
          await db.jsonDocuments.put(entity);
          return entity;
        }),
      );
    },

    async remove(id: string): Promise<void> {
      await safeWrite(() => db.jsonDocuments.delete(id));
    },
  };
}

export const jsonDocumentsRepository = createJsonDocumentsRepository();
