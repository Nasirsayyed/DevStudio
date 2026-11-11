import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from '@/test/db';
import { CURRENT_SCHEMA_VERSION, type DevStudioDatabase, SCHEMA_V1, TABLE_NAMES } from './database';

describe('DevStudioDatabase', () => {
  let database: DevStudioDatabase | undefined;
  afterEach(async () => {
    if (database) await database.delete();
  });

  it('opens with every required table at the current schema version', async () => {
    database = createTestDatabase();
    await database.open();
    expect(database.verno).toBe(CURRENT_SCHEMA_VERSION);
    const names = database.tables.map((t) => t.name).sort();
    expect(names).toEqual([...TABLE_NAMES].sort());
    for (const required of [
      'collections',
      'apiRequests',
      'environments',
      'apiHistory',
      'jsonDocuments',
      'savedQueries',
      'codeSnippets',
      'favorites',
      'toolHistory',
      'settings',
    ]) {
      expect(names).toContain(required);
    }
  });

  it('declares the indexes used by repositories', async () => {
    database = createTestDatabase();
    await database.open();
    const favorites = database.favorites.schema;
    expect(favorites.indexes.find((i) => i.name === '[entityType+entityId]')?.unique).toBe(true);
    expect(database.codeSnippets.schema.indexes.find((i) => i.name === 'tags')?.multi).toBe(true);
    expect(database.toolUsage.schema.primKey.name).toBe('toolId');
    expect(Object.keys(SCHEMA_V1)).toHaveLength(TABLE_NAMES.length);
  });

  it('persists data across connections (IndexedDB persistence)', async () => {
    database = createTestDatabase();
    const name = database.name;
    await database.settings.put({ key: 'k', value: { a: 1 }, updatedAt: 1 });
    database.close();
    const reopened = new Dexie(name);
    await reopened.open();
    expect(await reopened.table('settings').get('k')).toEqual({
      key: 'k',
      value: { a: 1 },
      updatedAt: 1,
    });
    reopened.close();
    await database.open();
  });

  it('rejects duplicate favorites through the unique compound index', async () => {
    database = createTestDatabase();
    const row = { entityType: 'tool' as const, entityId: 'json.formatter', createdAt: 1, order: 0 };
    await database.favorites.add({ id: 'a', ...row });
    await expect(database.favorites.add({ id: 'b', ...row })).rejects.toThrow();
  });
});
