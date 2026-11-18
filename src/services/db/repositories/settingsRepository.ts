import type { z } from 'zod';
import { type DevStudioDatabase, db as defaultDb } from '../database';
import { safeWrite } from '../safeWrite';

/**
 * Typed key/value settings stored in IndexedDB (for values too large or
 * structured for localStorage). Values are validated on read; invalid or
 * missing values fall back to the provided default.
 */
export function createSettingsRepository(db: DevStudioDatabase = defaultDb) {
  return {
    async get<S extends z.ZodType>(
      key: string,
      schema: S,
      fallback: z.output<S>,
    ): Promise<z.output<S>> {
      const row = await db.settings.get(key);
      if (!row) return fallback;
      const parsed = schema.safeParse(row.value);
      return parsed.success ? parsed.data : fallback;
    },

    async set(key: string, value: unknown): Promise<void> {
      await safeWrite(() => db.settings.put({ key, value, updatedAt: Date.now() }));
    },

    async remove(key: string): Promise<void> {
      await safeWrite(() => db.settings.delete(key));
    },
  };
}

export const settingsRepository = createSettingsRepository();
