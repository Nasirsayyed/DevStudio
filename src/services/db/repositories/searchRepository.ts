import type { EntityTable } from 'dexie';
import { type DevStudioDatabase, db as defaultDb } from '../database';

export type SearchEntityKind = 'request' | 'document' | 'query' | 'snippet' | 'history';

export interface EntitySearchResult {
  kind: SearchEntityKind;
  id: string;
  title: string;
  subtitle: string;
  updatedAt: number;
}

/**
 * Searches saved user data for the command palette.
 *
 * Strategy per table: an indexed, case-insensitive prefix query first (cheap),
 * then a bounded substring scan over the most recently updated rows to catch
 * mid-word matches. Each table contributes at most `perTable` results.
 */
export function createSearchRepository(db: DevStudioDatabase = defaultDb) {
  async function searchTable<T extends { id: string }>(
    table: EntityTable<T, 'id'>,
    indexField: string,
    recencyField: string,
    query: string,
    perTable: number,
    toResult: (row: T) => EntitySearchResult,
    scanLimit = 500,
  ): Promise<EntitySearchResult[]> {
    const q = query.toLowerCase();
    const prefix = await table
      .where(indexField)
      .startsWithIgnoreCase(query)
      .limit(perTable)
      .toArray();
    const seen = new Set(prefix.map((r) => r.id));
    const results = prefix.map(toResult);
    if (results.length < perTable) {
      const recent = await table.orderBy(recencyField).reverse().limit(scanLimit).toArray();
      for (const row of recent) {
        if (results.length >= perTable) break;
        if (seen.has(row.id)) continue;
        const r = toResult(row);
        if (r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)) {
          results.push(r);
          seen.add(row.id);
        }
      }
    }
    return results;
  }

  return {
    async search(query: string, perTable = 5): Promise<EntitySearchResult[]> {
      const trimmed = query.trim();
      if (!trimmed) return [];
      const groups = await Promise.all([
        searchTable(db.apiRequests, 'name', 'updatedAt', trimmed, perTable, (r) => ({
          kind: 'request',
          id: r.id,
          title: r.name,
          subtitle: `${r.method} ${r.url}`,
          updatedAt: r.updatedAt,
        })),
        searchTable(db.jsonDocuments, 'name', 'updatedAt', trimmed, perTable, (r) => ({
          kind: 'document',
          id: r.id,
          title: r.name,
          subtitle: r.tags.join(', '),
          updatedAt: r.updatedAt,
        })),
        searchTable(db.savedQueries, 'name', 'updatedAt', trimmed, perTable, (r) => ({
          kind: 'query',
          id: r.id,
          title: r.name,
          subtitle: `${r.dialect} · ${r.kind}`,
          updatedAt: r.updatedAt,
        })),
        searchTable(db.codeSnippets, 'title', 'updatedAt', trimmed, perTable, (r) => ({
          kind: 'snippet',
          id: r.id,
          title: r.title,
          subtitle: [r.language, ...r.tags].join(' · '),
          updatedAt: r.updatedAt,
        })),
        searchTable(db.toolHistory, 'toolId', 'createdAt', trimmed, perTable, (r) => ({
          kind: 'history',
          id: r.id,
          title: r.label,
          subtitle: r.toolId,
          updatedAt: r.createdAt,
        })),
      ]);
      return groups.flat();
    },
  };
}

export const searchRepository = createSearchRepository();
