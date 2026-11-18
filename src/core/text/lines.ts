import { secureShuffle, type RandomSource, cryptoRandom } from '../random/secureRandom';

/** Line tools: trim, filter, dedupe, sort, number, prefix/suffix. Applied in that order. */

export type TrimMode = 'none' | 'both' | 'start' | 'end';
export type DedupeMode = 'none' | 'exact' | 'ignore-case' | 'ignore-whitespace';
export type SortMode =
  | 'none'
  | 'asc'
  | 'desc'
  | 'natural'
  | 'natural-desc'
  | 'numeric'
  | 'numeric-desc'
  | 'length'
  | 'length-desc'
  | 'reverse'
  | 'shuffle';
export type FilterMode = 'none' | 'keep' | 'remove';

export interface LineOptions {
  trim: TrimMode;
  /** Also collapse runs of spaces/tabs inside lines. */
  collapseSpaces: boolean;
  removeEmpty: boolean;
  filter: FilterMode;
  /** Plain text (no regular expressions, so filtering can't hang). */
  filterText: string;
  filterCaseSensitive: boolean;
  dedupe: DedupeMode;
  /** Remove every line that occurs more than once (instead of keeping the first). */
  onlyUnique: boolean;
  sort: SortMode;
  caseSensitiveSort: boolean;
  prefix: string;
  suffix: string;
  numbering: boolean;
  numberingStart: number;
  numberingSeparator: string;
}

export const DEFAULT_LINE_OPTIONS: LineOptions = {
  trim: 'none',
  collapseSpaces: false,
  removeEmpty: false,
  filter: 'none',
  filterText: '',
  filterCaseSensitive: false,
  dedupe: 'none',
  onlyUnique: false,
  sort: 'none',
  caseSensitiveSort: false,
  prefix: '',
  suffix: '',
  numbering: false,
  numberingStart: 1,
  numberingSeparator: '. ',
};

export interface LineResult {
  text: string;
  inputLines: number;
  outputLines: number;
  duplicatesRemoved: number;
  emptyRemoved: number;
  filteredOut: number;
}

export function splitLines(text: string): string[] {
  return text === '' ? [] : text.split(/\r\n|\r|\n/);
}

/** Uses the input's line ending style (CRLF when most breaks are CRLF). */
export function detectEol(text: string): '\n' | '\r\n' {
  const crlf = text.match(/\r\n/g)?.length ?? 0;
  const lf = text.match(/\n/g)?.length ?? 0;
  return crlf > 0 && crlf * 2 >= lf ? '\r\n' : '\n';
}

function leadingNumber(line: string): number {
  const m = /^\s*([-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:e[-+]?\d+)?)/i.exec(line);
  return m?.[1] ? Number(m[1].replace(',', '.')) : NaN;
}

function sortLines(lines: string[], mode: SortMode, caseSensitive: boolean, random: RandomSource) {
  const sensitivity = caseSensitive ? 'variant' : 'accent';
  const plain = new Intl.Collator(undefined, { sensitivity });
  const natural = new Intl.Collator(undefined, { sensitivity, numeric: true });
  const byNumber = (a: string, b: string) => {
    const x = leadingNumber(a);
    const y = leadingNumber(b);
    if (Number.isNaN(x) && Number.isNaN(y)) return natural.compare(a, b);
    if (Number.isNaN(x)) return 1;
    if (Number.isNaN(y)) return -1;
    return x - y || natural.compare(a, b);
  };
  const copy = [...lines];
  switch (mode) {
    case 'none':
      return copy;
    case 'asc':
      return copy.sort(plain.compare);
    case 'desc':
      return copy.sort((a, b) => plain.compare(b, a));
    case 'natural':
      return copy.sort(natural.compare);
    case 'natural-desc':
      return copy.sort((a, b) => natural.compare(b, a));
    case 'numeric':
      return copy.sort(byNumber);
    case 'numeric-desc': {
      // Numbers descending; lines without a number stay at the end.
      const nums = copy
        .filter((l) => !Number.isNaN(leadingNumber(l)))
        .sort((a, b) => byNumber(b, a));
      return [...nums, ...copy.filter((l) => Number.isNaN(leadingNumber(l))).sort(natural.compare)];
    }
    case 'length':
      return copy.sort((a, b) => a.length - b.length);
    case 'length-desc':
      return copy.sort((a, b) => b.length - a.length);
    case 'reverse':
      return copy.reverse();
    case 'shuffle':
      return secureShuffle(copy, random);
  }
}

export function processLines(
  text: string,
  options: Partial<LineOptions> = {},
  random: RandomSource = cryptoRandom,
): LineResult {
  const o = { ...DEFAULT_LINE_OPTIONS, ...options };
  const eol = detectEol(text);
  let lines = splitLines(text);
  const inputLines = lines.length;

  lines = lines.map((line) => {
    let l = line;
    if (o.trim === 'both') l = l.trim();
    else if (o.trim === 'start') l = l.trimStart();
    else if (o.trim === 'end') l = l.trimEnd();
    if (o.collapseSpaces) l = l.replace(/[ \t]{2,}/g, ' ');
    return l;
  });

  let emptyRemoved = 0;
  if (o.removeEmpty) {
    const kept = lines.filter((l) => l.trim() !== '');
    emptyRemoved = lines.length - kept.length;
    lines = kept;
  }

  let filteredOut = 0;
  if (o.filter !== 'none' && o.filterText !== '') {
    const needle = o.filterCaseSensitive ? o.filterText : o.filterText.toLocaleLowerCase();
    const kept = lines.filter((l) => {
      const hay = o.filterCaseSensitive ? l : l.toLocaleLowerCase();
      return hay.includes(needle) === (o.filter === 'keep');
    });
    filteredOut = lines.length - kept.length;
    lines = kept;
  }

  let duplicatesRemoved = 0;
  if (o.dedupe !== 'none') {
    const keyOf = (l: string) =>
      o.dedupe === 'ignore-case'
        ? l.toLocaleLowerCase()
        : o.dedupe === 'ignore-whitespace'
          ? l.replace(/\s+/g, ' ').trim()
          : l;
    const counts = new Map<string, number>();
    for (const l of lines) counts.set(keyOf(l), (counts.get(keyOf(l)) ?? 0) + 1);
    const seen = new Set<string>();
    const kept = lines.filter((l) => {
      const k = keyOf(l);
      if (o.onlyUnique) return counts.get(k) === 1;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    duplicatesRemoved = lines.length - kept.length;
    lines = kept;
  }

  lines = sortLines(lines, o.sort, o.caseSensitiveSort, random);

  if (o.prefix || o.suffix) lines = lines.map((l) => `${o.prefix}${l}${o.suffix}`);
  if (o.numbering) {
    const width = String(o.numberingStart + lines.length - 1).length;
    lines = lines.map(
      (l, i) => `${String(o.numberingStart + i).padStart(width, ' ')}${o.numberingSeparator}${l}`,
    );
  }

  return {
    text: lines.join(eol),
    inputLines,
    outputLines: lines.length,
    duplicatesRemoved,
    emptyRemoved,
    filteredOut,
  };
}
