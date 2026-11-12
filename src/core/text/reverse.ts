/** Reversing text by grapheme, word or line (emoji and combining marks stay intact). */

export type ReverseMode = 'characters' | 'words' | 'lines' | 'each-word' | 'each-line';

export const REVERSE_MODES: readonly { id: ReverseMode; label: string }[] = [
  { id: 'characters', label: 'Characters' },
  { id: 'words', label: 'Word order (per line)' },
  { id: 'lines', label: 'Line order' },
  { id: 'each-word', label: 'Letters in each word' },
  { id: 'each-line', label: 'Characters in each line' },
];

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

export function graphemes(text: string): string[] {
  if (!segmenter) return Array.from(text);
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

const reverseGraphemes = (text: string) => graphemes(text).reverse().join('');
const LINE_SPLIT = /(\r\n|\r|\n)/;

/** Applies `fn` to every line, keeping the original line breaks. */
function perLine(text: string, fn: (line: string) => string): string {
  return text
    .split(LINE_SPLIT)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join('');
}

export function reverseText(text: string, mode: ReverseMode): string {
  switch (mode) {
    case 'characters': {
      // Keep "\r\n" pairs in order so Windows line breaks survive.
      return reverseGraphemes(text.replace(/\r\n/g, '\n'));
    }
    case 'lines': {
      const eol = text.includes('\r\n') ? '\r\n' : '\n';
      return text
        .split(/\r\n|\r|\n/)
        .reverse()
        .join(eol);
    }
    case 'words':
      return perLine(text, (line) => {
        const lead = /^\s*/.exec(line)?.[0] ?? '';
        const trail = /\s*$/.exec(line.slice(lead.length))?.[0] ?? '';
        const core = line.slice(lead.length, line.length - trail.length);
        return lead + core.split(/(\s+)/).reverse().join('') + trail;
      });
    case 'each-word':
      return text.replace(/[\p{L}\p{M}\p{N}_'’]+/gu, reverseGraphemes);
    case 'each-line':
      return perLine(text, reverseGraphemes);
  }
}
