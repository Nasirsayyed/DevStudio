import { utf8ByteLength } from '../json/format';

/** Text statistics: Unicode-aware characters, words and sentences (Intl.Segmenter). */

export interface TextStats {
  /** User-perceived characters (grapheme clusters): "👍🏽" counts as 1. */
  characters: number;
  charactersNoSpaces: number;
  codePoints: number;
  /** JavaScript string length (UTF-16 code units), e.g. for database or API limits. */
  utf16Units: number;
  utf8Bytes: number;
  words: number;
  uniqueWords: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  emptyLines: number;
  longestLineLength: number;
  averageWordLength: number;
  /** Reading time at 238 words per minute, in seconds. */
  readingSeconds: number;
  /** Speaking time at 150 words per minute, in seconds. */
  speakingSeconds: number;
  topWords: { word: string; count: number }[];
}

export const READING_WPM = 238;
export const SPEAKING_WPM = 150;

const STOP_WORDS = new Set(
  'a an and are as at be but by for from has have he her his i if in into is it its me my no not of on or our she so that the their them they this to was we were what when which who will with you your'.split(
    ' ',
  ),
);

const hasSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl;

function* wordsOf(text: string): Generator<string> {
  if (hasSegmenter) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'word' });
    for (const s of seg.segment(text)) if (s.isWordLike) yield s.segment;
    return;
  }
  yield* text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

function countGraphemes(text: string): number {
  if (!hasSegmenter) return Array.from(text).length;
  let n = 0;
  for (const _ of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) n += 1;
  return n;
}

function countSentences(text: string): number {
  if (!hasSegmenter)
    return text.split(/[.!?]+(?:\s|$)/).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
  let n = 0;
  for (const s of new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text))
    if (/[\p{L}\p{N}]/u.test(s.segment)) n += 1;
  return n;
}

export function textStats(
  text: string,
  options: { topWords?: number; ignoreStopWords?: boolean } = {},
): TextStats {
  const { topWords = 10, ignoreStopWords = true } = options;
  const lineList = text === '' ? [] : text.split(/\r\n|\r|\n/);
  const freq = new Map<string, number>();
  let words = 0;
  let letters = 0;
  for (const w of wordsOf(text)) {
    words += 1;
    letters += Array.from(w).length;
    const key = w.toLocaleLowerCase();
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const top = [...freq.entries()]
    .filter(([w]) => !ignoreStopWords || !STOP_WORDS.has(w))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topWords)
    .map(([word, count]) => ({ word, count }));
  return {
    characters: countGraphemes(text),
    charactersNoSpaces: countGraphemes(text.replace(/\s+/g, '')),
    codePoints: Array.from(text).length,
    utf16Units: text.length,
    utf8Bytes: utf8ByteLength(text),
    words,
    uniqueWords: freq.size,
    sentences: countSentences(text),
    paragraphs: text.split(/(?:\r\n|\r|\n)\s*(?:\r\n|\r|\n)/).filter((p) => p.trim() !== '').length,
    lines: lineList.length,
    emptyLines: lineList.filter((l) => l.trim() === '').length,
    longestLineLength: lineList.reduce((m, l) => Math.max(m, Array.from(l).length), 0),
    averageWordLength: words ? Math.round((letters / words) * 10) / 10 : 0,
    readingSeconds: Math.ceil((words / READING_WPM) * 60),
    speakingSeconds: Math.ceil((words / SPEAKING_WPM) * 60),
    topWords: top,
  };
}

/** "45 s", "3 min", "1 h 5 min". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
