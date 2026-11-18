import { ValidationError } from '../errors/AppError';
import { type RandomSource, cryptoRandom, randomInt } from '../random/secureRandom';

const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud ' +
  'exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur ' +
  'sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nulla gravida orci a odio ' +
  'nullam varius turpis et commodo pharetra eros bibendum elit nec luctus magna felis sollicitudin mauris integer sapien porttitor ligula vitae molestie diam ' +
  'dapibus sem vehicula quam semper fermentum risus posuere justo donec facilisis tortor aenean lectus mattis augue ornare viverra praesent dignissim ' +
  'sagittis suscipit feugiat ultricies scelerisque massa malesuada pulvinar imperdiet nunc faucibus volutpat condimentum vestibulum blandit accumsan'
).split(' ');

export type LoremUnit = 'words' | 'sentences' | 'paragraphs';

export const MAX_LOREM_COUNT = 500;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function generateLorem(
  unit: LoremUnit,
  count: number,
  startWithLorem = true,
  source: RandomSource = cryptoRandom,
): string {
  if (!Number.isInteger(count) || count < 1 || count > MAX_LOREM_COUNT)
    throw new ValidationError(`Count must be between 1 and ${MAX_LOREM_COUNT}.`);
  const word = () => WORDS[randomInt(WORDS.length, source)] ?? 'lorem';
  const words = (n: number) => Array.from({ length: n }, word);
  const sentence = () => {
    const ws = words(6 + randomInt(10, source));
    // Occasional comma for a natural rhythm.
    if (ws.length > 8) {
      const i = 3 + randomInt(ws.length - 6, source);
      ws[i] = `${ws[i] ?? ''},`;
    }
    return `${capitalize(ws.join(' '))}.`;
  };
  const paragraph = () => Array.from({ length: 4 + randomInt(4, source) }, sentence).join(' ');
  const opening = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

  if (unit === 'words') {
    const ws = words(count);
    if (startWithLorem)
      ['lorem', 'ipsum', 'dolor', 'sit', 'amet'].slice(0, count).forEach((w, i) => (ws[i] = w));
    return capitalize(ws.join(' '));
  }
  if (unit === 'sentences') {
    const ss = Array.from({ length: count }, sentence);
    if (startWithLorem) ss[0] = `${opening}.`;
    return ss.join(' ');
  }
  const ps = Array.from({ length: count }, paragraph);
  if (startWithLorem) ps[0] = `${opening}. ${ps[0] ?? ''}`;
  return ps.join('\n\n');
}
