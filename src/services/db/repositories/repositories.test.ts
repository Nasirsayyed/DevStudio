import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTestDatabase } from '@/test/db';
import type { DevStudioDatabase } from '../database';
import { createFavoritesRepository } from './favoritesRepository';
import { createSearchRepository } from './searchRepository';
import { createSettingsRepository } from './settingsRepository';
import { createToolUsageRepository } from './toolUsageRepository';
import { createWorkspaceRepository } from './workspaceRepository';

let database: DevStudioDatabase;

beforeEach(() => {
  database = createTestDatabase();
});
afterEach(async () => {
  await database.delete();
});

describe('favoritesRepository', () => {
  it('toggles favorites on and off', async () => {
    const repo = createFavoritesRepository(database);
    expect(await repo.toggle('tool', 'json.formatter')).toBe(true);
    expect(await repo.isFavorite('tool', 'json.formatter')).toBe(true);
    expect(await repo.toggle('tool', 'json.formatter')).toBe(false);
    expect(await repo.isFavorite('tool', 'json.formatter')).toBe(false);
  });

  it('lists favorites per type in insertion order', async () => {
    const repo = createFavoritesRepository(database);
    await repo.toggle('tool', 'b');
    await repo.toggle('tool', 'a');
    await repo.toggle('snippet', 's1');
    expect((await repo.list('tool')).map((f) => f.entityId)).toEqual(['b', 'a']);
    expect(await repo.count()).toBe(3);
    await repo.remove('tool', 'b');
    expect((await repo.list('tool')).map((f) => f.entityId)).toEqual(['a']);
  });
});

describe('toolUsageRepository', () => {
  it('increments counters and returns top tools by count', async () => {
    const repo = createToolUsageRepository(database);
    await repo.recordUse('a', 1);
    await repo.recordUse('b', 2);
    await repo.recordUse('b', 3);
    await repo.recordUse('c', 4);
    await repo.recordUse('b', 5);
    await repo.recordUse('c', 6);
    const top = await repo.top(2);
    expect(top.map((t) => [t.toolId, t.count])).toEqual([
      ['b', 3],
      ['c', 2],
    ]);
    expect(top[0]?.lastUsedAt).toBe(5);
    expect(await repo.totalUses()).toBe(6);
    await repo.clear();
    expect(await repo.top(5)).toEqual([]);
  });

  it('handles concurrent increments atomically', async () => {
    const repo = createToolUsageRepository(database);
    await Promise.all(Array.from({ length: 10 }, () => repo.recordUse('x')));
    expect((await repo.top(1))[0]?.count).toBe(10);
  });
});

describe('settingsRepository', () => {
  const schema = z.array(z.string());

  it('returns the fallback when missing or invalid', async () => {
    const repo = createSettingsRepository(database);
    expect(await repo.get('missing', schema, ['default'])).toEqual(['default']);
    await repo.set('bad', { not: 'an array' });
    expect(await repo.get('bad', schema, [])).toEqual([]);
  });

  it('stores and validates values', async () => {
    const repo = createSettingsRepository(database);
    await repo.set('qa', ['a', 'b']);
    expect(await repo.get('qa', schema, [])).toEqual(['a', 'b']);
    await repo.remove('qa');
    expect(await repo.get('qa', schema, ['x'])).toEqual(['x']);
  });
});

async function seed(db: DevStudioDatabase) {
  await db.codeSnippets.bulkAdd([
    {
      id: 's1',
      title: 'Debounce hook',
      description: '',
      code: '',
      language: 'typescript',
      category: 'react',
      tags: ['hooks'],
      isFavorite: 0,
      createdAt: 1,
      updatedAt: 10,
    },
    {
      id: 's2',
      title: 'Retry policy',
      description: '',
      code: '',
      language: 'csharp',
      category: 'net',
      tags: ['polly'],
      isFavorite: 1,
      createdAt: 2,
      updatedAt: 20,
    },
  ]);
  await db.jsonDocuments.add({
    id: 'd1',
    name: 'Orders payload',
    content: '{}',
    sizeBytes: 2,
    tags: ['orders'],
    createdAt: 1,
    updatedAt: 5,
  });
  await db.apiRequests.add({
    id: 'r1',
    collectionId: null,
    folderId: null,
    name: 'Get orders',
    method: 'GET',
    url: 'https://api.example.com/orders',
    config: {},
    createdAt: 1,
    updatedAt: 1,
  });
  await db.savedQueries.add({
    id: 'q1',
    name: 'Top customers',
    dialect: 'postgresql',
    kind: 'query',
    tags: [],
    content: 'select 1',
    createdAt: 1,
    updatedAt: 1,
  });
  await db.apiHistory.bulkAdd([
    {
      id: 'h1',
      createdAt: 100,
      requestId: 'r1',
      method: 'GET',
      url: 'https://a',
      status: 200,
      durationMs: 12,
      sizeBytes: 10,
      snapshot: {},
    },
    {
      id: 'h2',
      createdAt: 200,
      requestId: null,
      method: 'POST',
      url: 'https://b',
      status: 500,
      durationMs: 40,
      sizeBytes: 3,
      snapshot: {},
    },
  ]);
}

describe('workspaceRepository', () => {
  it('counts entities and returns recent items newest first', async () => {
    await seed(database);
    const repo = createWorkspaceRepository(database);
    expect(await repo.counts()).toMatchObject({
      codeSnippets: 2,
      jsonDocuments: 1,
      apiRequests: 1,
      savedQueries: 1,
      apiHistory: 2,
      favorites: 0,
    });
    expect((await repo.recentSnippets(5)).map((s) => s.id)).toEqual(['s2', 's1']);
    expect((await repo.recentApiHistory(1)).map((h) => h.id)).toEqual(['h2']);
    expect((await repo.recentJsonDocuments(5)).map((d) => d.id)).toEqual(['d1']);
    expect((await repo.recentQueries(5)).map((q) => q.id)).toEqual(['q1']);
  });
});

describe('searchRepository', () => {
  it('finds entities by prefix and by substring across tables', async () => {
    await seed(database);
    const repo = createSearchRepository(database);
    const prefix = await repo.search('debo');
    expect(prefix.map((r) => [r.kind, r.id])).toEqual([['snippet', 's1']]);
    const substring = await repo.search('orders');
    expect(substring.map((r) => r.id).sort()).toEqual(['d1', 'r1']);
  });

  it('matches subtitles (e.g. language, URL) and is case-insensitive', async () => {
    await seed(database);
    const repo = createSearchRepository(database);
    expect((await repo.search('CSHARP')).map((r) => r.id)).toEqual(['s2']);
    expect((await repo.search('example.com')).map((r) => r.id)).toEqual(['r1']);
  });

  it('returns nothing for blank queries and respects the per-table limit', async () => {
    await seed(database);
    const repo = createSearchRepository(database);
    expect(await repo.search('   ')).toEqual([]);
    expect(await repo.search('e', 1)).toHaveLength(4); // one per non-empty table match
  });
});
