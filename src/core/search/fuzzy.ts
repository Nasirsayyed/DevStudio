/**
 * Lightweight fuzzy matcher used by the command palette and tool search.
 * Scores (higher is better):
 *   exact match > prefix > word-prefix > substring > in-order subsequence.
 * Returns 0 when there is no match.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const t = text.toLowerCase();
  if (!t) return 0;

  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - Math.min(t.length - q.length, 100);

  const wordIndex = findWordPrefix(t, q);
  if (wordIndex >= 0) return 600 - Math.min(wordIndex, 100);

  const idx = t.indexOf(q);
  if (idx >= 0) return 400 - Math.min(idx, 100);

  // Subsequence: every query char appears in order. Reward contiguous runs.
  let score = 0;
  let ti = 0;
  let run = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    run = found === ti ? run + 1 : 0;
    score += 1 + run * 2;
    ti = found + 1;
  }
  return Math.min(200, 50 + score);
}

function findWordPrefix(text: string, query: string): number {
  const re = /[\s\-_/.:()]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const start = match.index + match[0].length;
    if (text.startsWith(query, start)) return start;
  }
  return -1;
}

export interface Searchable {
  /** Primary text, weighted highest. */
  title: string;
  /** Secondary texts (keywords, description, ...). */
  secondary?: readonly string[];
  /**
   * Context texts (e.g. the owning module's name). A strong prefix match here adds a
   * small bonus so "json" ranks JSON Studio tools above other tools merely starting with "JSON".
   */
  context?: readonly string[];
  /** Extra points added to a positive match (e.g. recently used items). */
  bonus?: number;
}

const CONTEXT_BONUS = 50;

/** Scores an item against all of its fields, weighting the title highest. */
export function scoreSearchable(query: string, item: Searchable): number {
  const titleScore = fuzzyScore(query, item.title);
  let best = titleScore;
  for (const s of item.secondary ?? []) {
    // Secondary fields only count for real substring / word matches, and weigh less.
    const sc = fuzzyScore(query, s);
    if (sc >= 400) best = Math.max(best, sc * 0.6);
  }
  if (best <= 0) return 0;
  if (item.context?.some((c) => fuzzyScore(query, c) >= 600)) best += CONTEXT_BONUS;
  return best + (item.bonus ?? 0);
}

/** Filters and sorts items by relevance. Stable for equal scores. */
export function rankBy<T>(
  query: string,
  items: readonly T[],
  toSearchable: (item: T) => Searchable,
  limit = Number.POSITIVE_INFINITY,
): T[] {
  if (!query.trim()) return items.slice(0, limit);
  return items
    .map((item, index) => ({ item, index, score: scoreSearchable(query, toSearchable(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((r) => r.item);
}
