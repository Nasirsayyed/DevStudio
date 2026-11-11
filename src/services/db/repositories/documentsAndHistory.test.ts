import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ValidationError } from '@/core/errors/AppError';
import { createTestDatabase } from '@/test/db';
import type { DevStudioDatabase } from '../database';
import { createJsonDocumentsRepository } from './jsonDocumentsRepository';
import {
  HISTORY_TEXT_LIMIT,
  TRUNCATION_MARKER,
  createToolHistoryRepository,
  truncateForHistory,
} from './toolHistoryRepository';

let database: DevStudioDatabase;
beforeEach(() => {
  database = createTestDatabase();
});
afterEach(async () => {
  await database.delete();
});

describe('jsonDocumentsRepository', () => {
  it('creates, updates (keeping createdAt), lists and deletes documents', async () => {
    const repo = createJsonDocumentsRepository(database);
    const created = await repo.save({ name: '  Orders  ', content: '{"a":"é"}', tags: ['api'] });
    expect(created.name).toBe('Orders');
    expect(created.sizeBytes).toBe(10);
    const updated = await repo.save({ id: created.id, name: 'Orders v2', content: '[]' });
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.tags).toEqual(['api']);
    await repo.save({ name: 'Users', content: '{}' });
    expect((await repo.list()).map((d) => d.name)).toEqual(['Users', 'Orders v2']);
    expect((await repo.list('ORD')).map((d) => d.name)).toEqual(['Orders v2']);
    expect((await repo.list('api')).map((d) => d.name)).toEqual(['Orders v2']);
    await repo.remove(created.id);
    expect(await repo.get(created.id)).toBeUndefined();
  });

  it('validates names', async () => {
    const repo = createJsonDocumentsRepository(database);
    await expect(repo.save({ name: '  ', content: '{}' })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.save({ name: 'x'.repeat(201), content: '{}' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe('toolHistoryRepository', () => {
  it('records entries newest first and filters by tool', async () => {
    const repo = createToolHistoryRepository(database);
    await repo.record({ toolId: 'json.formatter', label: 'Format', input: 'a', output: 'b' });
    await new Promise((r) => setTimeout(r, 2));
    await repo.record({
      toolId: 'json.minifier',
      label: 'Minify',
      input: 'c',
      output: 'd',
      options: { x: 1 },
    });
    expect((await repo.recent()).map((h) => h.toolId)).toEqual(['json.minifier', 'json.formatter']);
    expect((await repo.forTool('json.formatter')).map((h) => h.label)).toEqual(['Format']);
    const [latest] = await repo.recent(1);
    expect(latest?.options).toEqual({ x: 1 });
    await repo.remove(latest!.id);
    expect(await repo.recent()).toHaveLength(1);
    await repo.clear();
    expect(await repo.recent()).toEqual([]);
  });

  it('truncates large inputs and prunes old entries', async () => {
    const repo = createToolHistoryRepository(database, 3);
    const big = 'x'.repeat(HISTORY_TEXT_LIMIT + 10);
    const row = await repo.record({ toolId: 't', label: 'big', input: big, output: '' });
    expect(row.input.endsWith(TRUNCATION_MARKER)).toBe(true);
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 2));
      await repo.record({ toolId: 't', label: `n${i}`, input: '', output: '' });
    }
    const labels = (await repo.recent()).map((h) => h.label);
    expect(labels).toEqual(['n3', 'n2', 'n1']);
    expect(truncateForHistory('short')).toBe('short');
  });
});
