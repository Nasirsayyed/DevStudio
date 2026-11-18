import { describe, expect, it } from 'vitest';
import { fuzzyScore, rankBy } from './fuzzy';

describe('fuzzyScore', () => {
  it('ranks exact > prefix > word-prefix > substring > subsequence', () => {
    const exact = fuzzyScore('json', 'json');
    const prefix = fuzzyScore('json', 'json formatter');
    const word = fuzzyScore('form', 'json formatter');
    const substring = fuzzyScore('rmat', 'json formatter');
    const subseq = fuzzyScore('jsfmt', 'json formatter');
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(subseq);
    expect(subseq).toBeGreaterThan(0);
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(fuzzyScore('  JWT ', 'jwt decoder')).toBeGreaterThan(0);
  });

  it('returns 0 for non-matches and out-of-order characters', () => {
    expect(fuzzyScore('xyz', 'json formatter')).toBe(0);
    expect(fuzzyScore('nosj', 'json')).toBe(0);
    expect(fuzzyScore('a', '')).toBe(0);
  });

  it('treats an empty query as a match', () => {
    expect(fuzzyScore('', 'anything')).toBeGreaterThan(0);
  });

  it('handles regex metacharacters literally', () => {
    expect(fuzzyScore('c#', 'json to c#')).toBeGreaterThan(0);
    expect(fuzzyScore('(.*)', 'plain text')).toBe(0);
  });
});

describe('rankBy', () => {
  const items = [
    { title: 'SQL Formatter', keywords: ['format'] },
    { title: 'JSON Formatter', keywords: ['format', 'pretty'] },
    { title: 'JWT Decoder', keywords: ['token'] },
  ];
  const toSearchable = (i: (typeof items)[number]) => ({ title: i.title, secondary: i.keywords });

  it('returns all items in original order for an empty query (respecting limit)', () => {
    expect(rankBy('', items, toSearchable)).toEqual(items);
    expect(rankBy('  ', items, toSearchable, 2)).toHaveLength(2);
  });

  it('filters and sorts by relevance', () => {
    const result = rankBy('json', items, toSearchable);
    expect(result.map((r) => r.title)).toEqual(['JSON Formatter']);
  });

  it('matches secondary keywords with lower weight than titles', () => {
    const result = rankBy('token', items, toSearchable);
    expect(result[0]?.title).toBe('JWT Decoder');
  });

  it('boosts items whose context strongly matches the query', () => {
    const tools = [
      { title: 'JSON to C#', module: 'Codegen' },
      { title: 'JSON Formatter', module: 'JSON' },
    ];
    const ranked = rankBy('json', tools, (t) => ({ title: t.title, context: [t.module] }));
    expect(ranked.map((t) => t.title)).toEqual(['JSON Formatter', 'JSON to C#']);
    // Context alone never creates a match.
    expect(
      rankBy('json', [{ title: 'Base64', module: 'JSON' }], (t) => ({
        title: t.title,
        context: [t.module],
      })),
    ).toEqual([]);
  });

  it('applies bonuses only to items that already match', () => {
    const items = [
      { title: 'JSON Search' },
      { title: 'JSON Formatter', bonus: 30 },
      { title: 'Base64', bonus: 999 },
    ];
    expect(rankBy('json', items, (i) => i).map((i) => i.title)).toEqual([
      'JSON Formatter',
      'JSON Search',
    ]);
  });

  it('is stable for equal scores', () => {
    const result = rankBy('formatter', items, toSearchable);
    expect(result.map((r) => r.title)).toEqual(['SQL Formatter', 'JSON Formatter']);
  });
});
