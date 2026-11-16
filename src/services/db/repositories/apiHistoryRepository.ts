import type { ApiHistoryEntity, HttpMethod } from '@/types/entities';
import { type DevStudioDatabase, db as defaultDb } from '../database';
import { createId } from '../ids';
import { safeWrite } from '../safeWrite';

/** Sent requests and their responses. Credentials are redacted before recording. Import by path. */

export const MAX_HISTORY_ENTRIES = 500;
export const HISTORY_BODY_LIMIT = 256 * 1024;

export interface ApiHistorySnapshot {
  /** Request as sent (credentials redacted). */
  request: { method: HttpMethod; url: string; headers: [string, string][]; body: string | null };
  response: {
    status: number;
    statusText: string;
    headers: [string, string][];
    contentType: string;
    /** Text body, truncated to HISTORY_BODY_LIMIT; null for binary responses. */
    body: string | null;
    bodyTruncated: boolean;
    sizeBytes: number;
    durationMs: number;
  } | null;
  error: string | null;
  /** Editable request (credentials removed) to reopen in the builder. */
  draft: Record<string, unknown> | null;
  environment: string | null;
}

export function truncateBody(text: string | null): { body: string | null; truncated: boolean } {
  if (text === null) return { body: null, truncated: false };
  return text.length > HISTORY_BODY_LIMIT
    ? { body: text.slice(0, HISTORY_BODY_LIMIT), truncated: true }
    : { body: text, truncated: false };
}

export interface HistoryFilter {
  query?: string;
  method?: HttpMethod | null;
  /** 2 = 2xx, 4 = 4xx… 0 = failed (no response). */
  statusClass?: number | null;
}

export function createApiHistoryRepository(db: DevStudioDatabase = defaultDb) {
  const table = db.apiHistory;
  return {
    async record(input: {
      requestId: string | null;
      snapshot: ApiHistorySnapshot;
    }): Promise<ApiHistoryEntity> {
      const r = input.snapshot.response;
      const entity: ApiHistoryEntity = {
        id: createId(),
        createdAt: Date.now(),
        requestId: input.requestId,
        method: input.snapshot.request.method,
        url: input.snapshot.request.url,
        status: r ? r.status : null,
        durationMs: r ? r.durationMs : null,
        sizeBytes: r ? r.sizeBytes : null,
        snapshot: input.snapshot as unknown as Record<string, unknown>,
      };
      await safeWrite(() =>
        db.transaction('rw', table, async () => {
          await table.add(entity);
          const excess = (await table.count()) - MAX_HISTORY_ENTRIES;
          if (excess > 0) {
            const oldest = await table.orderBy('createdAt').limit(excess).primaryKeys();
            await table.bulkDelete(oldest);
          }
        }),
      );
      return entity;
    },

    async list(
      filter: HistoryFilter = {},
      limit = MAX_HISTORY_ENTRIES,
    ): Promise<ApiHistoryEntity[]> {
      const q = (filter.query ?? '').trim().toLowerCase();
      return table
        .orderBy('createdAt')
        .reverse()
        .filter(
          (h) =>
            (!filter.method || h.method === filter.method) &&
            (filter.statusClass === undefined ||
              filter.statusClass === null ||
              (filter.statusClass === 0
                ? h.status === null
                : h.status !== null && Math.floor(h.status / 100) === filter.statusClass)) &&
            (!q || h.url.toLowerCase().includes(q)),
        )
        .limit(limit)
        .toArray();
    },

    get(id: string): Promise<ApiHistoryEntity | undefined> {
      return table.get(id);
    },

    async remove(id: string): Promise<void> {
      await safeWrite(() => table.delete(id));
    },

    async clear(): Promise<void> {
      await safeWrite(() => table.clear());
    },
  };
}

export const apiHistoryRepository = createApiHistoryRepository();
