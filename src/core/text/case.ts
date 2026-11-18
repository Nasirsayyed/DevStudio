/** Case conversions for identifiers and prose. */

export type CaseStyle =
  | 'lower'
  | 'upper'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'screaming-snake'
  | 'kebab'
  | 'screaming-kebab'
  | 'train'
  | 'dot'
  | 'path'
  | 'alternating'
  | 'inverse';

export const CASE_STYLES: readonly { id: CaseStyle; label: string; example: string }[] = [
  { id: 'camel', label: 'camelCase', example: 'helloWorldApi' },
  { id: 'pascal', label: 'PascalCase', example: 'HelloWorldApi' },
  { id: 'snake', label: 'snake_case', example: 'hello_world_api' },
  { id: 'screaming-snake', label: 'SCREAMING_SNAKE_CASE', example: 'HELLO_WORLD_API' },
  { id: 'kebab', label: 'kebab-case', example: 'hello-world-api' },
  { id: 'screaming-kebab', label: 'COBOL-CASE', example: 'HELLO-WORLD-API' },
  { id: 'train', label: 'Train-Case', example: 'Hello-World-Api' },
  { id: 'dot', label: 'dot.case', example: 'hello.world.api' },
  { id: 'path', label: 'path/case', example: 'hello/world/api' },
  { id: 'lower', label: 'lower case', example: 'hello world api' },
  { id: 'upper', label: 'UPPER CASE', example: 'HELLO WORLD API' },
  { id: 'title', label: 'Title Case', example: 'Hello World Api' },
  { id: 'sentence', label: 'Sentence case', example: 'Hello world api' },
  { id: 'alternating', label: 'aLtErNaTiNg', example: 'hElLo WoRlD aPi' },
  { id: 'inverse', label: 'iNVERSE', example: 'HELLO world API' },
];

/**
 * Word boundaries for identifiers: separators, camelCase humps and acronyms.
 * "XMLHttpRequest" → XML, Http, Request; "HTML5Parser" → HTML5, Parser; "userID" → user, ID.
 */
const WORD_RE =
  /\p{Lu}+(?=\p{Lu}\p{Ll})|\p{Lu}?\p{Ll}+\p{N}*|\p{Lu}+\p{N}*|\p{N}+|[\p{Lo}\p{Lt}\p{Lm}]+/gu;

export function splitWords(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

const cap = (w: string) => {
  const [first = '', ...rest] = Array.from(w);
  return first.toLocaleUpperCase() + rest.join('').toLocaleLowerCase();
};

function joinWords(words: string[], style: CaseStyle): string {
  const lower = words.map((w) => w.toLocaleLowerCase());
  switch (style) {
    case 'camel':
      return lower.map((w, i) => (i === 0 ? w : cap(w))).join('');
    case 'pascal':
      return words.map(cap).join('');
    case 'snake':
      return lower.join('_');
    case 'screaming-snake':
      return words.map((w) => w.toLocaleUpperCase()).join('_');
    case 'kebab':
      return lower.join('-');
    case 'screaming-kebab':
      return words.map((w) => w.toLocaleUpperCase()).join('-');
    case 'train':
      return words.map(cap).join('-');
    case 'dot':
      return lower.join('.');
    case 'path':
      return lower.join('/');
    default:
      return words.join(' ');
  }
}

function sentenceCase(text: string): string {
  let start = true;
  let out = '';
  for (const ch of text.toLocaleLowerCase()) {
    if (start && /\p{L}/u.test(ch)) {
      out += ch.toLocaleUpperCase();
      start = false;
    } else {
      out += ch;
      if (/[.!?]/.test(ch)) start = true;
    }
  }
  return out;
}

function alternating(text: string): string {
  let i = 0;
  let out = '';
  for (const ch of text) {
    if (/\p{L}/u.test(ch)) {
      out += i % 2 === 0 ? ch.toLocaleLowerCase() : ch.toLocaleUpperCase();
      i += 1;
    } else out += ch;
  }
  return out;
}

function inverse(text: string): string {
  let out = '';
  for (const ch of text) {
    const up = ch.toLocaleUpperCase();
    out += ch === up ? ch.toLocaleLowerCase() : up;
  }
  return out;
}

function convertProse(text: string, style: CaseStyle): string | null {
  switch (style) {
    case 'lower':
      return text.toLocaleLowerCase();
    case 'upper':
      return text.toLocaleUpperCase();
    case 'title':
      return text.replace(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’]*/gu, cap);
    case 'sentence':
      return sentenceCase(text);
    case 'alternating':
      return alternating(text);
    case 'inverse':
      return inverse(text);
    default:
      return null;
  }
}

/**
 * Converts text to a case style. Identifier styles (camelCase, snake_case, …) are applied to each
 * line separately, so a list of names converts line by line; prose styles keep punctuation.
 */
export function convertCase(text: string, style: CaseStyle): string {
  const prose = convertProse(text, style);
  if (prose !== null) return prose;
  return text
    .split(/(\r\n|\r|\n)/)
    .map((part, i) => (i % 2 === 1 ? part : joinWords(splitWords(part), style)))
    .join('');
}
