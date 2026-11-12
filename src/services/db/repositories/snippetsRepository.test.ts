import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '@/core/errors/AppError';
import { parseSnippetFile, planImport } from '@/core/snippets/exchange';
import { createTestDatabase } from '@/test/db';
import type { DevStudioDatabase } from '../database';
import { createSnippetsRepository } from './snippetsRepository';

let database: DevStudioDatabase;
let repo: ReturnType<typeof createSnippetsRepository>;
const draft = {
  title: 'Hello',
  description: '',
  code: 'print(1)',
  language: 'python',
  category: 'Scripts',
  tags: ['py'],
};

beforeEach(() => {
  database = createTestDatabase();
  repo = createSnippetsRepository(database);
});
afterEach(async () => {
  await database.delete();
});

describe('snippetsRepository', () => {
  it('creates, updates and lists snippets (newest first)', async () => {
    const a = await repo.save(draft);
    const b = await repo.save({ ...draft, title: 'Second' });
    expect(a).toMatchObject({ title: 'Hello', isFavorite: 0, category: 'Scripts' });
    const updated = await repo.save({
      ...draft,
      id: a.id,
      title: 'Renamed',
      tags: ['#py', 'PY', 'new'],
    });
    expect(updated.createdAt).toBe(a.createdAt);
    expect(updated.tags).toEqual(['py', 'new']);
    expect((await repo.list()).map((s) => s.title)).toEqual(['Renamed', 'Second']);
    expect(b.id).not.toBe(a.id);
  });

  it('validates before writing and reports missing snippets', async () => {
    await expect(repo.save({ ...draft, title: ' ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.save({ ...draft, id: 'missing' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.toggleFavorite('missing')).rejects.toThrow('This snippet no longer exists.');
    expect(await database.codeSnippets.count()).toBe(0);
  });

  it('toggles favorites without changing the update time, duplicates, deletes and restores', async () => {
    const a = await repo.save(draft);
    expect(await repo.toggleFavorite(a.id)).toBe(true);
    expect(await repo.get(a.id)).toMatchObject({ isFavorite: 1, updatedAt: a.updatedAt });
    expect(await repo.toggleFavorite(a.id)).toBe(false);
    const copy = await repo.duplicate(a.id);
    expect(copy).toMatchObject({ title: 'Hello (copy)', code: 'print(1)', isFavorite: 0 });
    const before = await repo.list();
    await repo.removeMany([a.id, copy.id]);
    expect(await repo.list()).toEqual([]);
    await repo.restore(before);
    expect(await repo.list()).toEqual(before);
  });

  it('renames and deletes categories', async () => {
    await repo.save(draft);
    await repo.save({ ...draft, title: 'Two' });
    await repo.save({ ...draft, title: 'Other', category: 'Testing' });
    expect(await repo.renameCategory('Scripts', '  Shell scripts ')).toBe(2);
    expect((await repo.list()).map((s) => s.category).sort()).toEqual([
      'Shell scripts',
      'Shell scripts',
      'Testing',
    ]);
    expect(await repo.deleteCategory('Testing')).toBe(1);
    expect((await repo.list()).filter((s) => s.category === 'General')).toHaveLength(1);
  });

  it('applies import plans atomically and keeps ids for re-imports', async () => {
    const existing = await repo.save(draft);
    const file = JSON.stringify([
      { id: existing.id, title: 'Hello v2', code: 'print(2)', language: 'python' },
      { id: 'imported-1', title: 'New', code: 'x', isFavorite: true },
    ]);
    const parsed = parseSnippetFile(file);
    const result = await repo.applyImport(planImport(await repo.list(), parsed.items, 'replace'));
    expect(result).toEqual({ added: 1, updated: 1, skipped: 0 });
    expect(await repo.get(existing.id)).toMatchObject({
      title: 'Hello v2',
      code: 'print(2)',
      createdAt: existing.createdAt,
    });
    expect(await repo.get('imported-1')).toMatchObject({ title: 'New', isFavorite: 1 });

    // Re-importing the same file with "skip" changes nothing.
    expect(await repo.applyImport(planImport(await repo.list(), parsed.items, 'skip'))).toEqual({
      added: 0,
      updated: 0,
      skipped: 2,
    });
    // A failing write rolls back the whole import.
    const plan = planImport([], parsed.items, 'skip');
    await expect(repo.applyImport(plan)).rejects.toThrow();
    expect(await database.codeSnippets.count()).toBe(2);
  });
});
