import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '@/core/errors/AppError';
import { createTestDatabase } from '@/test/db';
import type { DevStudioDatabase } from '../database';
import { createSavedQueriesRepository, MAX_SQLITE_DB_BYTES } from './savedQueriesRepository';

let database: DevStudioDatabase;
let repo: ReturnType<typeof createSavedQueriesRepository>;

beforeEach(() => {
  database = createTestDatabase();
  repo = createSavedQueriesRepository(database);
});
afterEach(async () => {
  await database.delete();
});

describe('savedQueriesRepository', () => {
  it('saves, updates, lists by kind and summarizes without contents', async () => {
    const q = await repo.save({
      name: ' Report ',
      dialect: 'postgresql',
      kind: 'query',
      content: 'select 1',
      tags: ['#ops', 'OPS'],
    });
    expect(q).toMatchObject({ name: 'Report', tags: ['ops'], sizeBytes: 8 });
    const dbFile = await repo.save({
      name: 'Shop',
      dialect: 'sqlite',
      kind: 'sqliteDb',
      content: new Uint8Array(1234),
    });
    const updated = await repo.save({
      id: q.id,
      name: 'Report v2',
      dialect: 'mysql',
      kind: 'query',
      content: 'select 2',
    });
    expect(updated.createdAt).toBe(q.createdAt);
    expect(updated.tags).toEqual(['ops']);
    expect((await repo.list('query')).map((x) => x.name)).toEqual(['Report v2']);
    expect(await repo.summaries('sqliteDb')).toEqual([
      {
        id: dbFile.id,
        name: 'Shop',
        dialect: 'sqlite',
        kind: 'sqliteDb',
        tags: [],
        updatedAt: dbFile.updatedAt,
        size: 1234,
      },
    ]);
    expect((await repo.summaries(undefined, 'OPS')).map((x) => x.name)).toEqual(['Report v2']);
    await repo.remove(q.id);
    expect(await repo.get(q.id)).toBeUndefined();
  });

  it('validates names and sizes and reports missing items', async () => {
    await expect(
      repo.save({ name: '  ', dialect: 'sqlite', kind: 'query', content: 'x' }),
    ).rejects.toThrow(ValidationError);
    await expect(
      repo.save({ name: 'x'.repeat(201), dialect: 'sqlite', kind: 'query', content: 'x' }),
    ).rejects.toThrow(/200 characters/);
    await expect(
      repo.save({
        name: 'big',
        dialect: 'sqlite',
        kind: 'sqliteDb',
        content: { byteLength: MAX_SQLITE_DB_BYTES + 1 } as Uint8Array,
      }),
    ).rejects.toThrow(/100 MB/);
    await expect(
      repo.save({ id: 'nope', name: 'x', dialect: 'sqlite', kind: 'query', content: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
