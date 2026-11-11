import type { ToolUsageEntity } from '@/types/entities';
import { type DevStudioDatabase, db as defaultDb } from '../database';
import { safeWrite } from '../safeWrite';

export function createToolUsageRepository(db: DevStudioDatabase = defaultDb) {
  return {
    /** Atomically increments the usage counter of a tool. */
    async recordUse(toolId: string, now = Date.now()): Promise<void> {
      await safeWrite(() =>
        db.transaction('rw', db.toolUsage, async () => {
          const existing = await db.toolUsage.get(toolId);
          await db.toolUsage.put({
            toolId,
            count: (existing?.count ?? 0) + 1,
            lastUsedAt: now,
          });
        }),
      );
    },

    /** Most used tools, using the `count` index (no full scan + sort in JS). */
    async top(limit: number): Promise<ToolUsageEntity[]> {
      return db.toolUsage.orderBy('count').reverse().limit(limit).toArray();
    },

    async totalUses(): Promise<number> {
      let total = 0;
      await db.toolUsage.each((row) => {
        total += row.count;
      });
      return total;
    },

    async clear(): Promise<void> {
      await safeWrite(() => db.toolUsage.clear());
    },
  };
}

export const toolUsageRepository = createToolUsageRepository();
