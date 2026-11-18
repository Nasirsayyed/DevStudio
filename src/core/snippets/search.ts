import type { CodeSnippetEntity } from '@/types/entities';

/** In-memory filtering, ranking and facets for the snippet library. */

export type SnippetSort = 'updated' | 'created' | 'title' | 'language';

export interface SnippetFilter {
  query: string;
  category: string | null;
  language: string | null;
  tag: string | null;
  favoritesOnly: boolean;
  sort: SnippetSort;
}

export const EMPTY_FILTER: SnippetFilter = {
  query: '',
  category: null,
  language: null,
  tag: null,
  favoritesOnly: false,
  sort: 'updated',
};

const lower = (s: string) => s.toLocaleLowerCase();

/**
 * Relevance of a snippet for a query: every word must appear in the title, tags, category,
 * language, description or code. Title and tag hits rank higher than code hits.
 * Returns 0 when the snippet does not match.
 */
export function snippetScore(s: CodeSnippetEntity, query: string): number {
  const words = lower(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  const title = lower(s.title);
  const tags = s.tags.map(lower);
  const meta = `${lower(s.category)} ${s.language}`;
  const description = lower(s.description);
  let code: string | null = null;
  let score = 0;
  for (const w of words) {
    const tagWord = w.replace(/^#/, '');
    if (title.startsWith(w)) score += 12;
    else if (title.includes(w)) score += 8;
    else if (tags.some((t) => t === tagWord)) score += 7;
    else if (tags.some((t) => t.includes(tagWord))) score += 5;
    else if (meta.includes(w)) score += 4;
    else if (description.includes(w)) score += 3;
    else {
      code ??= lower(s.code);
      if (code.includes(w)) score += 1;
      else return 0;
    }
  }
  return score;
}

export function filterSnippets(
  snippets: readonly CodeSnippetEntity[],
  filter: Partial<SnippetFilter>,
): CodeSnippetEntity[] {
  const f = { ...EMPTY_FILTER, ...filter };
  const scored: { s: CodeSnippetEntity; score: number }[] = [];
  for (const s of snippets) {
    if (f.favoritesOnly && s.isFavorite !== 1) continue;
    if (f.category !== null && s.category !== f.category) continue;
    if (f.language !== null && s.language !== f.language) continue;
    if (f.tag !== null && !s.tags.some((t) => lower(t) === lower(f.tag ?? ''))) continue;
    const score = snippetScore(s, f.query);
    if (score > 0) scored.push({ s, score });
  }
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  const bySort = (a: CodeSnippetEntity, b: CodeSnippetEntity) => {
    switch (f.sort) {
      case 'title':
        return collator.compare(a.title, b.title);
      case 'created':
        return b.createdAt - a.createdAt;
      case 'language':
        return collator.compare(a.language, b.language) || collator.compare(a.title, b.title);
      default:
        return b.updatedAt - a.updatedAt;
    }
  };
  // With a query, relevance wins and the chosen order breaks ties.
  scored.sort((x, y) => (f.query.trim() ? y.score - x.score : 0) || bySort(x.s, y.s));
  return scored.map((x) => x.s);
}

export interface SnippetFacets {
  total: number;
  favorites: number;
  categories: { name: string; count: number }[];
  languages: { name: string; count: number }[];
  tags: { name: string; count: number }[];
}

function counted(map: Map<string, number>, byCount = false) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (byCount ? b.count - a.count : 0) || a.name.localeCompare(b.name));
}

/** Counts per category, language and tag (tags grouped case-insensitively). */
export function snippetFacets(snippets: readonly CodeSnippetEntity[]): SnippetFacets {
  const categories = new Map<string, number>();
  const languages = new Map<string, number>();
  const tags = new Map<string, number>();
  const tagNames = new Map<string, string>();
  let favorites = 0;
  for (const s of snippets) {
    if (s.isFavorite === 1) favorites += 1;
    categories.set(s.category, (categories.get(s.category) ?? 0) + 1);
    languages.set(s.language, (languages.get(s.language) ?? 0) + 1);
    for (const t of s.tags) {
      const key = lower(t);
      if (!tagNames.has(key)) tagNames.set(key, t);
      const name = tagNames.get(key) ?? t;
      tags.set(name, (tags.get(name) ?? 0) + 1);
    }
  }
  return {
    total: snippets.length,
    favorites,
    categories: counted(categories),
    languages: counted(languages, true),
    tags: counted(tags, true),
  };
}
