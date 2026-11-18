import { z } from 'zod';
import { ValidationError } from '../errors/AppError';
import { normalizeLanguage } from '../languages/languages';

/** Snippet rules shared by the editor, the repository and imports. */

export const SNIPPET_LIMITS = {
  title: 200,
  description: 2_000,
  /** Characters of code per snippet. */
  code: 1_000_000,
  category: 60,
  tags: 20,
  tag: 40,
} as const;

export const DEFAULT_CATEGORY = 'General';
export const SUGGESTED_CATEGORIES = [
  'General',
  'Frontend',
  'Backend',
  'Database',
  'DevOps',
  'Scripts',
  'Testing',
  'Snippets for docs',
] as const;

/** What the user edits; ids, timestamps and favorite state are managed by the repository. */
export interface SnippetDraft {
  title: string;
  description: string;
  code: string;
  language: string;
  category: string;
  tags: string[];
}

/** Trims, drops empty and duplicate (case-insensitive) tags, and strips "#" and commas. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/^#+/, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function normalizeCategory(category: string): string {
  const c = category.replace(/\s+/g, ' ').trim();
  return c || DEFAULT_CATEGORY;
}

/** Form/import validation. Messages are written for people. */
export const snippetDraftSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give the snippet a title.')
    .max(SNIPPET_LIMITS.title, `Titles can have at most ${SNIPPET_LIMITS.title} characters.`),
  description: z
    .string()
    .max(
      SNIPPET_LIMITS.description,
      `Descriptions can have at most ${SNIPPET_LIMITS.description.toLocaleString('en-US')} characters.`,
    ),
  code: z
    .string()
    .refine((c) => c.trim() !== '', 'The snippet has no code.')
    .refine(
      (c) => c.length <= SNIPPET_LIMITS.code,
      'Snippets can hold at most 1,000,000 characters of code.',
    ),
  language: z.string(),
  category: z
    .string()
    .max(
      SNIPPET_LIMITS.category,
      `Categories can have at most ${SNIPPET_LIMITS.category} characters.`,
    ),
  tags: z
    .array(
      z.string().max(SNIPPET_LIMITS.tag, `Tags can have at most ${SNIPPET_LIMITS.tag} characters.`),
    )
    .max(SNIPPET_LIMITS.tags, `A snippet can have at most ${SNIPPET_LIMITS.tags} tags.`),
});

/** Validates and normalizes a draft, or throws a ValidationError with the first problem. */
export function prepareSnippet(draft: SnippetDraft): SnippetDraft {
  const normalized = {
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    language: normalizeLanguage(draft.language),
    category: normalizeCategory(draft.category),
    tags: normalizeTags(draft.tags),
  };
  const result = snippetDraftSchema.safeParse(normalized);
  if (!result.success)
    throw new ValidationError(result.error.issues[0]?.message ?? 'The snippet is not valid.');
  return normalized;
}

export function emptySnippet(language = 'typescript', category = DEFAULT_CATEGORY): SnippetDraft {
  return { title: '', description: '', code: '', language, category, tags: [] };
}
