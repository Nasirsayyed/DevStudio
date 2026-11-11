/** Identifier utilities shared by all code emitters. */

/** Splits snake_case, kebab-case, camelCase, PascalCase, "spaced words" and ACRONYMWords. */
export function splitWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export function toPascalCase(name: string): string {
  return splitWords(name).map(capitalize).join('');
}

export function toCamelCase(name: string): string {
  const pascal = toPascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toSnakeCase(name: string): string {
  return splitWords(name)
    .map((w) => w.toLowerCase())
    .join('_');
}

const IRREGULAR: Record<string, string> = {
  people: 'person',
  children: 'child',
  men: 'man',
  women: 'woman',
  mice: 'mouse',
  geese: 'goose',
  feet: 'foot',
  teeth: 'tooth',
  criteria: 'criterion',
  indices: 'index',
  matrices: 'matrix',
  analyses: 'analysis',
  statuses: 'status',
  buses: 'bus',
  movies: 'movie',
  cookies: 'cookie',
  data: 'data',
  media: 'media',
  news: 'news',
  series: 'series',
  species: 'species',
};

/** Applies the letter case of `source` (UPPER, Capitalized, lower) to `target`. */
function matchCase(source: string, target: string): string {
  if (source.length > 1 && source === source.toUpperCase()) return target.toUpperCase();
  if (source.charAt(0) === source.charAt(0).toUpperCase())
    return target.charAt(0).toUpperCase() + target.slice(1);
  return target;
}

/** Best-effort English singular for class names derived from array properties. */
export function singularize(word: string): string {
  const irregular = IRREGULAR[word.toLowerCase()];
  if (irregular) return matchCase(word, irregular);
  if (/(ss|x|z|ch|sh)es$/i.test(word)) return word.slice(0, -2);
  if (/[^aeiou]ies$/i.test(word)) return word.slice(0, -3) + matchCase(word.slice(-3), 'y');
  if (/(ss|us|is)$/i.test(word)) return word;
  if (/s$/i.test(word) && word.length > 2) return word.slice(0, -1);
  return word;
}

/** Singularizes the last word of a compound name: "order_items" → "order_item". */
export function singularizeName(name: string): string {
  const words = splitWords(name);
  const last = words.pop();
  if (last === undefined) return name;
  return [...words, singularize(last)].join('_');
}

/**
 * Turns an arbitrary JSON key into a valid identifier using `caseFn`, falling
 * back to `fallback` for keys with no usable characters, and prefixing keys
 * that start with a digit.
 */
export function toIdentifier(
  name: string,
  caseFn: (s: string) => string,
  fallback = 'value',
  digitPrefix = '_',
): string {
  let id = caseFn(name);
  if (!id) id = caseFn(fallback);
  if (/^[0-9]/.test(id)) id = `${digitPrefix}${id}`;
  return id;
}

/** Allocates unique names within a scope: "Item", "Item2", "Item3"… */
export class NameScope {
  private readonly used = new Set<string>();
  private readonly caseInsensitive: boolean;

  constructor(reserved: Iterable<string> = [], caseInsensitive = false) {
    this.caseInsensitive = caseInsensitive;
    for (const r of reserved) this.used.add(this.norm(r));
  }

  private norm(name: string): string {
    return this.caseInsensitive ? name.toLowerCase() : name;
  }

  has(name: string): boolean {
    return this.used.has(this.norm(name));
  }

  claim(base: string): string {
    let name = base;
    for (let i = 2; this.used.has(this.norm(name)); i++) name = `${base}${i}`;
    this.used.add(this.norm(name));
    return name;
  }
}

/** True for identifiers valid in C-family languages. */
export function isPlainIdentifier(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}
