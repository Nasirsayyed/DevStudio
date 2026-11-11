import type { ToolHistoryEntity } from '@/types/entities';
import { type DevStudioDatabase, db as defaultDb } from '../database';
import { createId } from '../ids';
import { safeWrite } from '../safeWrite';

/** Inputs/outputs larger than this are truncated before storage. */
export const HISTORY_TEXT_LIMIT = 256 * 1024;
/** Oldest entries beyond this count are pruned. */
export const HISTORY_MAX_ENTRIES = 1000;

export const TRUNCATION_MARKER = '\n…[truncated by DevStudio]';

export function truncateForHistory(text: string, limit = HISTORY_TEXT_LIMIT): string {
  return text.length > limit ? text.slice(0, limit) + TRUNCATION_MARKER : text;
}

export interface RecordToolHistoryInput {
  toolId: string;
  label: string;
  input: string;
  output: string;
  options?: Record<string, unknown>;
  durationMs?: number | null;
}

export function createToolHistoryRepository(
  db: DevStudioDatabase = defaultDb,
  maxEntries = HISTORY_MAX_ENTRIES,
) {
  return {
    async record(entry: RecordToolHistoryInput): Promise<ToolHistoryEntity> {
      const row: ToolHistoryEntity = {
        id: createId(),
        createdAt: Date.now(),
        toolId: entry.toolId,
        label: entry.label.slice(0, 200),
        input: truncateForHistory(entry.input),
        output: truncateForHistory(entry.output),
        options: entry.options ?? {},
        durationMs: entry.durationMs ?? null,
      };
      await safeWrite(() =>
        db.transaction('rw', db.toolHistory, async () => {
          await db.toolHistory.add(row);
          const count = await db.toolHistory.count();
          if (count > maxEntries) {
            const stale = await db.toolHistory
              .orderBy('createdAt')
              .limit(count - maxEntries)
              .primaryKeys();
            await db.toolHistory.bulkDelete(stale);
          }
        }),
      );
      return row;
    },

    recent(limit = 50): Promise<ToolHistoryEntity[]> {
      return db.toolHistory.orderBy('createdAt').reverse().limit(limit).toArray();
    },

    forTool(toolId: string, limit = 50): Promise<ToolHistoryEntity[]> {
      return db.toolHistory
        .where('[toolId+createdAt]')
        .between([toolId, -Infinity], [toolId, Infinity])
        .reverse()
        .limit(limit)
        .toArray();
    },

    get(id: string): Promise<ToolHistoryEntity | undefined> {
      return db.toolHistory.get(id);
    },

    async remove(id: string): Promise<void> {
      await safeWrite(() => db.toolHistory.delete(id));
    },

    async clear(): Promise<void> {
      await safeWrite(() => db.toolHistory.clear());
    },
  };
}

export const toolHistoryRepository = createToolHistoryRepository();
