import { createTwoFilesPatch, diffArrays, diffChars, diffWordsWithSpace } from 'diff';
import { ValidationError } from '../errors/AppError';

/** Line diff with intra-line highlights, folding of unchanged regions and unified patches. */

export interface TextDiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  /** Highlight changed words or characters inside changed lines. */
  inline: 'word' | 'char' | 'none';
}

export interface Segment {
  text: string;
  /** Changed relative to the other side. */
  changed: boolean;
}

export interface DiffLine {
  /** 1-based line number on its side. */
  no: number;
  text: string;
  segments?: Segment[];
}

export type DiffRow =
  | { kind: 'equal'; left: DiffLine; right: DiffLine }
  | { kind: 'delete'; left: DiffLine }
  | { kind: 'insert'; right: DiffLine }
  | { kind: 'change'; left: DiffLine; right: DiffLine };

export interface TextDiffResult {
  rows: DiffRow[];
  stats: { added: number; removed: number; changed: number; unchanged: number };
  identical: boolean;
  /** Unified diff (patch) of the two texts. */
  patch: string;
}

export const DIFF_TIMEOUT_MS = 8_000;
const INLINE_MAX_CHARS = 2_000;

function toLines(value: string): string[] {
  const lines = value.split(/\r\n|\r|\n/);
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function segmentsFor(a: string, b: string, mode: TextDiffOptions['inline'], ignoreCase: boolean) {
  if (mode === 'none' || a.length > INLINE_MAX_CHARS || b.length > INLINE_MAX_CHARS) return null;
  const parts =
    mode === 'char' ? diffChars(a, b, { ignoreCase }) : diffWordsWithSpace(a, b, { ignoreCase });
  const left: Segment[] = [];
  const right: Segment[] = [];
  for (const p of parts) {
    if (!p.added) left.push({ text: p.value, changed: p.removed });
    if (!p.removed) right.push({ text: p.value, changed: p.added });
  }
  return { left, right };
}

export function diffTexts(
  original: string,
  modified: string,
  options: Partial<TextDiffOptions> = {},
): TextDiffResult {
  const { ignoreWhitespace = false, ignoreCase = false, inline = 'word' } = options;
  const a = original.replace(/\r\n?/g, '\n');
  const b = modified.replace(/\r\n?/g, '\n');
  const aLines = toLines(a);
  const bLines = toLines(b);
  const normalize = (line: string) => {
    let l = ignoreWhitespace ? line.trim().replace(/\s+/g, ' ') : line;
    if (ignoreCase) l = l.toLocaleLowerCase();
    return l;
  };
  const changes = diffArrays(aLines, bLines, {
    comparator: (x: string, y: string) => x === y || normalize(x) === normalize(y),
    timeout: DIFF_TIMEOUT_MS,
  });
  if (!changes)
    throw new ValidationError(
      'The texts are too different to compare within the time limit. Try smaller inputs.',
    );

  const rows: DiffRow[] = [];
  const stats = { added: 0, removed: 0, changed: 0, unchanged: 0 };
  let ln = 1;
  let rn = 1;
  const pushDelete = () => {
    rows.push({ kind: 'delete', left: { no: ln, text: aLines[ln - 1] ?? '' } });
    ln += 1;
    stats.removed += 1;
  };
  const pushInsert = () => {
    rows.push({ kind: 'insert', right: { no: rn, text: bLines[rn - 1] ?? '' } });
    rn += 1;
    stats.added += 1;
  };
  for (let i = 0; i < changes.length; i += 1) {
    const c = changes[i];
    if (!c) continue;
    const count = c.value.length;
    if (!c.added && !c.removed) {
      for (let k = 0; k < count; k += 1) {
        // With ignore options the sides may differ textually: show each side's own text.
        rows.push({
          kind: 'equal',
          left: { no: ln, text: aLines[ln - 1] ?? '' },
          right: { no: rn, text: bLines[rn - 1] ?? '' },
        });
        ln += 1;
        rn += 1;
      }
      stats.unchanged += count;
      continue;
    }
    const next = changes[i + 1];
    if (c.removed && next?.added) {
      const removed = count;
      const added = next.value.length;
      const paired = Math.min(removed, added);
      for (let k = 0; k < paired; k += 1) {
        const lt = aLines[ln - 1] ?? '';
        const rt = bLines[rn - 1] ?? '';
        const seg = segmentsFor(lt, rt, inline, ignoreCase);
        rows.push({
          kind: 'change',
          left: { no: ln, text: lt, ...(seg ? { segments: seg.left } : {}) },
          right: { no: rn, text: rt, ...(seg ? { segments: seg.right } : {}) },
        });
        ln += 1;
        rn += 1;
        stats.changed += 1;
      }
      for (let k = paired; k < removed; k += 1) pushDelete();
      for (let k = paired; k < added; k += 1) pushInsert();
      i += 1;
      continue;
    }
    for (let k = 0; k < count; k += 1) {
      if (c.removed) pushDelete();
      else pushInsert();
    }
  }
  const identical = stats.added + stats.removed + stats.changed === 0;
  // The rows ignore a missing final newline, so the patch does too (otherwise the last line
  // would show up as changed).
  const eol = (t: string) => (t === '' || t.endsWith('\n') ? t : `${t}\n`);
  const patch = identical
    ? ''
    : createTwoFilesPatch('original', 'modified', eol(a), eol(b), '', '', { context: 3 });
  return { rows, stats, identical, patch };
}

export type DiffItem =
  { kind: 'row'; row: DiffRow; index: number } | { kind: 'fold'; start: number; count: number };

/**
 * Collapses long runs of unchanged rows, keeping `context` rows around changes.
 * Folds whose start index is in `expanded` stay open.
 */
export function foldUnchanged(
  rows: readonly DiffRow[],
  context: number,
  expanded: ReadonlySet<number> = new Set(),
): DiffItem[] {
  const items: DiffItem[] = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i]?.kind !== 'equal') {
      const row = rows[i];
      if (row) items.push({ kind: 'row', row, index: i });
      i += 1;
      continue;
    }
    let j = i;
    while (j < rows.length && rows[j]?.kind === 'equal') j += 1;
    const keepStart = i === 0 ? 0 : context;
    const keepEnd = j === rows.length ? 0 : context;
    const hidden = j - i - keepStart - keepEnd;
    const foldStart = i + keepStart;
    if (hidden > 1 && !expanded.has(foldStart)) {
      for (let k = i; k < foldStart; k += 1) {
        const row = rows[k];
        if (row) items.push({ kind: 'row', row, index: k });
      }
      items.push({ kind: 'fold', start: foldStart, count: hidden });
      for (let k = j - keepEnd; k < j; k += 1) {
        const row = rows[k];
        if (row) items.push({ kind: 'row', row, index: k });
      }
    } else {
      for (let k = i; k < j; k += 1) {
        const row = rows[k];
        if (row) items.push({ kind: 'row', row, index: k });
      }
    }
    i = j;
  }
  return items;
}
