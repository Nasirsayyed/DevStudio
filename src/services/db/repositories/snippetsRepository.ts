import { NotFoundError } from '@/core/errors/AppError';
import type { ImportPlan } from '@/core/snippets/exchange';
import {
  DEFAULT_CATEGORY,
  normalizeCategory,
  prepareSnippet,
  type SnippetDraft,
} from '@/core/snippets/model';
import type { CodeSnippetEntity } from '@/types/entities';
import { type DevStudioDatabase, db as defaultDb } from '../database';
import { createId } from '../ids';
import { safeWrite } from '../safeWrite';

export interface SaveSnippetInput extends SnippetDraft {
  /** Existing id to update; omit to create. */
  id?: string;
  isFavorite?: boolean;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

/**
 * The snippet library (codeSnippets table). Every write is validated and quota-aware.
 * Import it by path (not from the repositories barrel) so it stays out of the initial bundle.
 */
export function createSnippetsRepository(db: DevStudioDatabase = defaultDb) {
  const table = db.codeSnippets;
  return {
    /** All snippets, most recently updated first. */
    list(): Promise<CodeSnippetEntity[]> {
      return table.orderBy('updatedAt').reverse().toArray();
    },

    get(id: string): Promise<CodeSnippetEntity | undefined> {
      return table.get(id);
    },

    async save(input: SaveSnippetInput): Promise<CodeSnippetEntity> {
      const draft = prepareSnippet(input);
      return safeWrite(() =>
        db.transaction('rw', table, async () => {
          const existing = input.id ? await table.get(input.id) : undefined;
          if (input.id && !existing) throw new NotFoundError('This snippet no longer exists.');
          const now = Date.now();
          const entity: CodeSnippetEntity = {
            id: existing?.id ?? createId(),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            ...draft,
            isFavorite:
              input.isFavorite === undefined
                ? (existing?.isFavorite ?? 0)
                : input.isFavorite
                  ? 1
                  : 0,
          };
          await table.put(entity);
          return entity;
        }),
      );
    },

    /** Toggles the favorite flag without touching `updatedAt` (so the order does not jump). */
    async toggleFavorite(id: string): Promise<boolean> {
      return safeWrite(() =>
        db.transaction('rw', table, async () => {
          const s = await table.get(id);
          if (!s) throw new NotFoundError('This snippet no longer exists.');
          const next = s.isFavorite === 1 ? 0 : 1;
          await table.update(id, { isFavorite: next });
          return next === 1;
        }),
      );
    },

    async duplicate(id: string): Promise<CodeSnippetEntity> {
      const s = await table.get(id);
      if (!s) throw new NotFoundError('This snippet no longer exists.');
      const { id: _id, createdAt: _c, updatedAt: _u, isFavorite: _f, ...draft } = s;
      return this.save({ ...draft, title: `${s.title} (copy)`.slice(0, 200) });
    },

    async remove(id: string): Promise<void> {
      await safeWrite(() => table.delete(id));
    },

    async removeMany(ids: readonly string[]): Promise<void> {
      await safeWrite(() => table.bulkDelete([...ids]));
    },

    /** Restores deleted snippets exactly as they were (undo). */
    async restore(snippets: readonly CodeSnippetEntity[]): Promise<void> {
      await safeWrite(() => table.bulkPut([...snippets]));
    },

    /** Renames a category on every snippet that uses it; returns how many changed. */
    async renameCategory(from: string, to: string): Promise<number> {
      const target = normalizeCategory(to);
      return safeWrite(() => table.where('category').equals(from).modify({ category: target }));
    },

    /** Moves the snippets of a category to "General". */
    async deleteCategory(name: string): Promise<number> {
      return safeWrite(() =>
        table.where('category').equals(name).modify({ category: DEFAULT_CATEGORY }),
      );
    },

    /** Applies an import plan in one transaction (all or nothing). */
    async applyImport(plan: ImportPlan): Promise<ImportResult> {
      return safeWrite(() =>
        db.transaction('rw', table, async () => {
          const now = Date.now();
          const added = plan.add.map((item, i): CodeSnippetEntity => ({
            id: item.id ?? createId(),
            createdAt: item.createdAt ?? now,
            // Keeps the file's order when sorting by "updated".
            updatedAt: item.updatedAt ?? now - i,
            title: item.title,
            description: item.description,
            code: item.code,
            language: item.language,
            category: item.category,
            tags: item.tags,
            isFavorite: item.isFavorite ? 1 : 0,
          }));
          await table.bulkAdd(added);
          let updated = 0;
          for (const { id, item } of plan.update) {
            updated += await table.update(id, {
              title: item.title,
              description: item.description,
              code: item.code,
              language: item.language,
              category: item.category,
              tags: item.tags,
              isFavorite: item.isFavorite ? 1 : 0,
              updatedAt: now,
            });
          }
          return { added: added.length, updated, skipped: plan.skipped };
        }),
      );
    },
  };
}

export const snippetsRepository = createSnippetsRepository();
