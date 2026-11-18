import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import { convertCase, splitWords } from './case';
import { diffTexts, foldUnchanged } from './diff';
import { buildFindRegExp, findAll, replaceAll, type FindOptions } from './findReplace';
import { detectEol, processLines } from './lines';
import { graphemes, reverseText } from './reverse';
import { formatDuration, textStats } from './stats';

describe('case conversion', () => {
  it.each([
    ['XMLHttpRequest', ['XML', 'Http', 'Request']],
    ['HTML5Parser', ['HTML5', 'Parser']],
    ['userID', ['user', 'ID']],
    ['snake_case-and kebab', ['snake', 'case', 'and', 'kebab']],
    ['  café au lait  ', ['café', 'au', 'lait']],
    ['version2Beta', ['version2', 'Beta']],
    ['', []],
    ['--__--', []],
  ])('splits %j into words', (text, words) => {
    expect(splitWords(text)).toEqual(words);
  });

  it.each([
    ['camel', 'helloWorldApi'],
    ['pascal', 'HelloWorldApi'],
    ['snake', 'hello_world_api'],
    ['screaming-snake', 'HELLO_WORLD_API'],
    ['kebab', 'hello-world-api'],
    ['screaming-kebab', 'HELLO-WORLD-API'],
    ['train', 'Hello-World-Api'],
    ['dot', 'hello.world.api'],
    ['path', 'hello/world/api'],
  ] as const)('converts identifiers to %s', (style, expected) => {
    expect(convertCase('hello world API', style)).toBe(expected);
    expect(convertCase('helloWorldAPI', style)).toBe(expected);
  });

  it('converts each line separately for identifier styles and keeps line breaks', () => {
    expect(convertCase('first name\r\nlast-name\n\nuser_id', 'camel')).toBe(
      'firstName\r\nlastName\n\nuserId',
    );
  });

  it('handles prose styles without losing punctuation', () => {
    expect(convertCase('hello, WORLD! how are you? fine.', 'sentence')).toBe(
      'Hello, world! How are you? Fine.',
    );
    expect(convertCase("it's a dog's life", 'title')).toBe("It's A Dog's Life");
    expect(convertCase('Hello World', 'inverse')).toBe('hELLO wORLD');
    expect(convertCase('hello world', 'alternating')).toBe('hElLo WoRlD');
    expect(convertCase('straße', 'upper')).toBe('STRASSE');
  });
});

describe('reverse', () => {
  it('keeps emoji, flags and combining marks intact', () => {
    expect(reverseText('ab👍🏽c', 'characters')).toBe('c👍🏽ba');
    expect(reverseText('🇩🇪x', 'characters')).toBe('x🇩🇪');
    expect(reverseText('éa', 'characters')).toBe('aé');
    expect(graphemes('👨‍👩‍👧')).toHaveLength(1);
  });

  it('reverses lines, word order and letters in words', () => {
    expect(reverseText('a\r\nb\r\nc', 'lines')).toBe('c\r\nb\r\na');
    expect(reverseText('  one two  three\nfour five', 'words')).toBe('  three  two one\nfive four');
    expect(reverseText('hello, world!', 'each-word')).toBe('olleh, dlrow!');
    expect(reverseText('abc\ndef', 'each-line')).toBe('cba\nfed');
    expect(reverseText('', 'characters')).toBe('');
  });
});

describe('line tools', () => {
  it('dedupes keeping the first occurrence, or keeps only unique lines', () => {
    const text = 'b\na\nB\nb\nc';
    expect(processLines(text, { dedupe: 'exact' })).toMatchObject({
      text: 'b\na\nB\nc',
      duplicatesRemoved: 1,
    });
    expect(processLines(text, { dedupe: 'ignore-case' }).text).toBe('b\na\nc');
    expect(processLines(text, { dedupe: 'exact', onlyUnique: true }).text).toBe('a\nB\nc');
    expect(processLines(' a  b\na b ', { dedupe: 'ignore-whitespace' }).text).toBe(' a  b');
  });

  it('sorts alphabetically, naturally, numerically and by length', () => {
    const files = 'file10\nfile2\nFile1';
    expect(processLines(files, { sort: 'natural' }).text).toBe('File1\nfile2\nfile10');
    expect(processLines(files, { sort: 'asc' }).text).toBe('File1\nfile10\nfile2');
    expect(processLines(files, { sort: 'natural-desc' }).text).toBe('file10\nfile2\nFile1');
    expect(processLines('10 kg\n-2\nabc\n3.5\n1e3', { sort: 'numeric' }).text).toBe(
      '-2\n3.5\n10 kg\n1e3\nabc',
    );
    expect(processLines('10\nx\n2', { sort: 'numeric-desc' }).text).toBe('10\n2\nx');
    expect(processLines('ccc\na\nbb', { sort: 'length' }).text).toBe('a\nbb\nccc');
    expect(processLines('1\n2\n3', { sort: 'reverse' }).text).toBe('3\n2\n1');
  });

  it('shuffles with the injected random source and keeps every line', () => {
    const counter = (bytes: Uint8Array<ArrayBuffer>) => bytes.fill(0);
    const out = processLines('a\nb\nc\nd', { sort: 'shuffle' }, counter).text.split('\n');
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('trims, removes empty lines, filters, numbers and wraps lines (CRLF kept)', () => {
    const r = processLines('  apple  \r\n\r\n banana\r\ncherry pie\r\n', {
      trim: 'both',
      removeEmpty: true,
      filter: 'remove',
      filterText: 'PIE',
      prefix: '"',
      suffix: '",',
      numbering: true,
    });
    expect(r.text).toBe('1. "apple",\r\n2. "banana",');
    expect(r).toMatchObject({ inputLines: 5, outputLines: 2, emptyRemoved: 2, filteredOut: 1 });
    expect(processLines('a', { numbering: true, numberingStart: 9 }).text).toBe('9. a');
    expect(
      processLines(Array.from({ length: 10 }, (_, i) => String(i)).join('\n'), {
        numbering: true,
      }).text.split('\n')[0],
    ).toBe(' 1. 0');
    expect(processLines('', { sort: 'asc' })).toMatchObject({ text: '', inputLines: 0 });
    expect(detectEol('a\nb\r\nc')).toBe('\r\n');
    expect(detectEol('a\nb\nc\r\nd')).toBe('\n');
  });
});

describe('text statistics', () => {
  it('counts graphemes, code points, UTF-16 units and UTF-8 bytes', () => {
    const s = textStats('Héllo 👍🏽');
    expect(s).toMatchObject({
      characters: 7,
      codePoints: 8,
      utf16Units: 10,
      utf8Bytes: 15,
      words: 1,
    });
  });

  it('counts words, sentences, paragraphs and lines', () => {
    const text = "It's 3.5 degrees. Don't go out!\n\nSecond paragraph here?\nYes\n";
    const s = textStats(text);
    expect(s.words).toBe(10);
    expect(s.sentences).toBe(4);
    expect(s.paragraphs).toBe(2);
    expect(s.lines).toBe(5);
    expect(s.emptyLines).toBe(2);
    expect(s.topWords[0]).toBeDefined();
  });

  it('handles empty input and computes reading time', () => {
    expect(textStats('')).toMatchObject({
      characters: 0,
      words: 0,
      lines: 0,
      sentences: 0,
      readingSeconds: 0,
    });
    const long = textStats(Array.from({ length: 476 }, () => 'word').join(' '));
    expect(long.readingSeconds).toBe(120);
    expect(long.speakingSeconds).toBe(191);
    expect(long.topWords).toEqual([{ word: 'word', count: 476 }]);
    expect(textStats('the the cat', { ignoreStopWords: true }).topWords).toEqual([
      { word: 'cat', count: 1 },
    ]);
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(150)).toBe('3 min');
    expect(formatDuration(3900)).toBe('1 h 5 min');
  });
});

const find = (query: string, extra: Partial<FindOptions> = {}): FindOptions => ({
  query,
  regex: false,
  caseSensitive: false,
  wholeWord: false,
  multiline: true,
  dotAll: false,
  ...extra,
});

describe('find and replace', () => {
  it('finds plain text with regex metacharacters literally, with positions', () => {
    const r = findAll('a.b\r\nxa.b a*b', find('a.b'));
    expect(r.total).toBe(2);
    expect(r.matches.map((m) => [m.line, m.column])).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(r.matches[1]).toMatchObject({ before: 'x', after: ' a*b' });
  });

  it('respects case sensitivity and whole words (Unicode aware)', () => {
    expect(findAll('Cat cat category écat', find('cat')).total).toBe(4);
    expect(findAll('Cat cat category écat', find('cat', { caseSensitive: true })).total).toBe(3);
    expect(findAll('Cat cat category écat', find('cat', { wholeWord: true })).total).toBe(2);
  });

  it('replaces with groups in regex mode and literally in plain mode', () => {
    const r = replaceAll('2024-01-31 and 1999-12-01', {
      ...find('(\\d{4})-(\\d{2})-(?<day>\\d{2})', { regex: true }),
      replacement: '$<day>/$2/$1',
      interpretEscapes: false,
    });
    expect(r.output).toBe('31/01/2024 and 01/12/1999');
    expect(r.replacements).toBe(2);
    expect(r.matches[0]?.groups).toEqual(['2024', '01', '31']);
    expect(
      replaceAll('cost: 5', { ...find('5'), replacement: '$&$1 €', interpretEscapes: false })
        .output,
    ).toBe('cost: $&$1 €');
    expect(
      replaceAll('a,b', { ...find(','), replacement: '\\n', interpretEscapes: true }).output,
    ).toBe('a\nb');
  });

  it('supports multiline anchors, dotAll and zero-length matches', () => {
    expect(findAll('a\nb\nc', find('^', { regex: true })).total).toBe(3);
    expect(findAll('a\nb', find('a.b', { regex: true })).total).toBe(0);
    expect(findAll('a\nb', find('a.b', { regex: true, dotAll: true })).total).toBe(1);
    expect(
      replaceAll('a\nb', {
        ...find('^', { regex: true }),
        replacement: '> ',
        interpretEscapes: false,
      }).output,
    ).toBe('> a\n> b');
  });

  it('reports unmatched optional groups as empty and truncates long result lists', () => {
    expect(findAll('ac', find('a(b)?c', { regex: true })).matches[0]?.groups).toEqual(['']);
    const r = findAll('x'.repeat(50), find('x'), 10);
    expect(r).toMatchObject({ total: 50, truncated: true });
    expect(r.matches).toHaveLength(10);
  });

  it('rejects empty queries and invalid expressions with clear messages', () => {
    expect(() => buildFindRegExp(find(''))).toThrow('Enter text to find.');
    expect(() => buildFindRegExp(find('(a', { regex: true }))).toThrow(ValidationError);
    expect(() => buildFindRegExp(find('(a', { regex: true }))).toThrow(
      /^Invalid regular expression/,
    );
    expect(() => buildFindRegExp(find('(a'))).not.toThrow();
  });
});

describe('text diff', () => {
  it('pairs changed lines with word highlights and counts changes', () => {
    const r = diffTexts('one\ntwo\nthree\nfour', 'one\n2\nthree\nfour\nfive');
    expect(r.stats).toEqual({ added: 1, removed: 0, changed: 1, unchanged: 3 });
    expect(r.rows.map((x) => x.kind)).toEqual(['equal', 'change', 'equal', 'equal', 'insert']);
    const change = r.rows[1];
    expect(change?.kind === 'change' && change.right.segments).toEqual([
      { text: '2', changed: true },
    ]);
    expect(r.patch).toContain('-two\n+2');
    expect(r.patch).not.toContain('No newline');
    expect(r.patch).not.toContain('-four');
    expect(r.identical).toBe(false);
  });

  it('highlights words inside a changed line', () => {
    const r = diffTexts('the quick brown fox', 'the slow brown fox');
    const row = r.rows[0];
    expect(row?.kind).toBe('change');
    if (row?.kind !== 'change') return;
    expect(row.left.segments?.filter((s) => s.changed).map((s) => s.text)).toEqual(['quick']);
    expect(row.right.segments?.filter((s) => s.changed).map((s) => s.text)).toEqual(['slow']);
  });

  it('treats CRLF and LF as equal and can ignore whitespace and case', () => {
    expect(diffTexts('a\r\nb\r\n', 'a\nb').identical).toBe(true);
    expect(diffTexts('a  b\nC', ' a b \nc', { ignoreWhitespace: true }).identical).toBe(false);
    expect(
      diffTexts('a  b\nC', ' a b \nc', { ignoreWhitespace: true, ignoreCase: true }).identical,
    ).toBe(true);
    expect(diffTexts('', '').identical).toBe(true);
    expect(diffTexts('', 'x').stats.added).toBe(1);
    expect(diffTexts('x', '').stats.removed).toBe(1);
  });

  it('folds long unchanged runs but keeps context around changes', () => {
    const a = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
    const b = a.replace('line 10', 'LINE 10');
    const { rows } = diffTexts(a, b);
    const items = foldUnchanged(rows, 2);
    expect(items.map((i) => (i.kind === 'fold' ? `fold:${i.count}` : i.row.kind))).toEqual([
      'fold:8',
      'equal',
      'equal',
      'change',
      'equal',
      'equal',
      'fold:7',
    ]);
    expect(foldUnchanged(rows, 2, new Set([0])).filter((i) => i.kind === 'fold')).toHaveLength(1);
  });
});
