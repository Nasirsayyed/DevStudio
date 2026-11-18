import type { FavoriteEntity, FavoriteEntityType } from '@/types/entities';
import { type DevStudioDatabase, db as defaultDb } from '../database';
import { createId } from '../ids';
import { safeWrite } from '../safeWrite';

export function createFavoritesRepository(db: DevStudioDatabase = defaultDb) {
  return {
    /** Favorites of one type, in user-defined order (then oldest first). */
    async list(entityType: FavoriteEntityType): Promise<FavoriteEntity[]> {
      const rows = await db.favorites.where('entityType').equals(entityType).toArray();
      return rows.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
    },

    async isFavorite(entityType: FavoriteEntityType, entityId: string): Promise<boolean> {
      const count = await db.favorites
        .where('[entityType+entityId]')
        .equals([entityType, entityId])
        .count();
      return count > 0;
    },

    /** Adds or removes a favorite. Returns the new state. */
    async toggle(entityType: FavoriteEntityType, entityId: string): Promise<boolean> {
      return safeWrite(() =>
        db.transaction('rw', db.favorites, async () => {
          const existing = await db.favorites
            .where('[entityType+entityId]')
            .equals([entityType, entityId])
            .first();
          if (existing) {
            await db.favorites.delete(existing.id);
            return false;
          }
          const count = await db.favorites.where('entityType').equals(entityType).count();
          await db.favorites.add({
            id: createId(),
            entityType,
            entityId,
            createdAt: Date.now(),
            order: count,
          });
          return true;
        }),
      );
    },

    async remove(entityType: FavoriteEntityType, entityId: string): Promise<void> {
      await safeWrite(() =>
        db.favorites.where('[entityType+entityId]').equals([entityType, entityId]).delete(),
      );
    },

    async count(): Promise<number> {
      return db.favorites.count();
    },
  };
}

export const favoritesRepository = createFavoritesRepository();
