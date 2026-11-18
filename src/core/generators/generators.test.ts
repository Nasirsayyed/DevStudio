import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import {
  type RandomSource,
  randomFromCharset,
  randomInt,
  secureShuffle,
} from '../random/secureRandom';
import { generateLorem } from './lorem';
import {
  DEFAULT_PASSWORD_OPTIONS,
  entropyStrength,
  generatePassword,
  passwordPoolSize,
} from './password';
import { CHARSET_PRESETS, generateRandomStrings } from './randomString';
import { formatGuid, generateUuids, inspectUuid, UUID_NAMESPACES } from './uuid';

/** Deterministic byte stream for reproducible tests. */
function seeded(seed = 1): RandomSource {
  let x = seed;
  return (bytes) => {
    for (let i = 0; i < bytes.length; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      bytes[i] = x & 0xff;
    }
    return bytes;
  };
}

describe('secure random', () => {
  it('randomInt stays in range and is roughly uniform', () => {
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 6000; i++) counts[randomInt(6)]! += 1;
    for (const c of counts) expect(c).toBeGreaterThan(850);
    expect(() => randomInt(0)).toThrow(ValidationError);
  });

  it('rejects biased values (rejection sampling)', () => {
    // First draw is 0xFFFFFFFF (above the unbiased limit for 3), second is 4 → 4 % 3 = 1.
    const draws = [0xffffffff, 4];
    const source: RandomSource = (bytes) => {
      new DataView(bytes.buffer).setUint32(0, draws.shift() ?? 0, true);
      return bytes;
    };
    expect(randomInt(3, source)).toBe(1);
  });

  it('picks from Unicode charsets and shuffles without losing items', () => {
    expect(Array.from(randomFromCharset('😀🎉', 10))).toHaveLength(10);
    expect(() => randomFromCharset('', 3)).toThrow(ValidationError);
    expect(secureShuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('password generator', () => {
  it('includes every selected class and honours exclusions', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword({
        ...DEFAULT_PASSWORD_OPTIONS,
        length: 8,
        excludeAmbiguous: true,
        exclude: 'abc',
      });
      expect(p).toHaveLength(8);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/\d/);
      expect(p).toMatch(/[^A-Za-z0-9]/);
      expect(p).not.toMatch(/[Il1O0o|`'"abc]/);
    }
  });

  it('validates options', () => {
    expect(() => generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 3 })).toThrow(
      /between 4 and 256/,
    );
    expect(() =>
      generatePassword({
        ...DEFAULT_PASSWORD_OPTIONS,
        lowercase: false,
        uppercase: false,
        digits: false,
        symbols: false,
      }),
    ).toThrow(/at least one/);
    expect(
      generatePassword(
        {
          ...DEFAULT_PASSWORD_OPTIONS,
          symbols: false,
          uppercase: false,
          lowercase: false,
          length: 6,
        },
        seeded(),
      ),
    ).toMatch(/^\d{6}$/);
  });

  it('estimates entropy from length and pool size', () => {
    expect(passwordPoolSize(DEFAULT_PASSWORD_OPTIONS)).toBe(26 + 26 + 10 + 32);
    expect(entropyStrength(20, 94)).toMatchObject({ bits: 131, label: 'Very strong', score: 4 });
    expect(entropyStrength(8, 10)).toMatchObject({ bits: 27, label: 'Very weak' });
    expect(entropyStrength(12, 26).label).toBe('Fair');
  });
});

describe('random strings', () => {
  it('uses presets and custom sets', () => {
    const hex = generateRandomStrings({ preset: 'hex', custom: '', length: 32, count: 5 });
    expect(hex).toHaveLength(5);
    for (const s of hex) expect(s).toMatch(/^[0-9a-f]{32}$/);
    expect(
      generateRandomStrings({ preset: 'custom', custom: 'xy', length: 10, count: 1 })[0],
    ).toMatch(/^[xy]{10}$/);
    expect(CHARSET_PRESETS.crockford).not.toMatch(/[ILOU]/);
  });

  it('validates limits', () => {
    expect(() => generateRandomStrings({ preset: 'hex', custom: '', length: 0, count: 1 })).toThrow(
      ValidationError,
    );
    expect(() =>
      generateRandomStrings({ preset: 'hex', custom: '', length: 5, count: 5000 }),
    ).toThrow(ValidationError);
    expect(() =>
      generateRandomStrings({ preset: 'custom', custom: 'aaa', length: 5, count: 1 }),
    ).toThrow(/at least 2/);
  });
});

describe('UUIDs', () => {
  it('generates versions 4, 7, 1 and 6 that inspect correctly', () => {
    for (const [v, n] of [
      ['v4', 4],
      ['v7', 7],
      ['v1', 1],
      ['v6', 6],
    ] as const) {
      const [id] = generateUuids(v, 1);
      const info = inspectUuid(id!);
      expect(info).toMatchObject({ valid: true, version: n, variant: 'RFC 9562' });
      if (n !== 4)
        expect(Math.abs((info.timestamp?.getTime() ?? 0) - Date.now())).toBeLessThan(60_000);
    }
    expect(new Set(generateUuids('v4', 100)).size).toBe(100);
  });

  it('generates deterministic v5 and special values', () => {
    expect(
      generateUuids('v5', 1, { namespace: UUID_NAMESPACES.DNS, name: 'www.example.com' }),
    ).toEqual(['2ed6657d-e927-568b-95e1-2665a8aea6a2']);
    expect(() => generateUuids('v5', 1, { namespace: 'nope', name: 'x' })).toThrow(ValidationError);
    expect(generateUuids('nil', 5)).toEqual(['00000000-0000-0000-0000-000000000000']);
    expect(inspectUuid('ffffffff-ffff-ffff-ffff-ffffffffffff')).toMatchObject({
      valid: true,
      variant: 'MAX',
    });
  });

  it('formats GUIDs like .NET and parses those formats back', () => {
    const id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    expect(formatGuid(id, 'N', false)).toBe('6ba7b8109dad11d180b400c04fd430c8');
    expect(formatGuid(id, 'B', true)).toBe('{6BA7B810-9DAD-11D1-80B4-00C04FD430C8}');
    expect(formatGuid(id, 'P', false)).toBe('(6ba7b810-9dad-11d1-80b4-00c04fd430c8)');
    expect(formatGuid(id, 'X', false)).toBe(
      '{0x6ba7b810,0x9dad,0x11d1,{0x80,0xb4,0x00,0xc0,0x4f,0xd4,0x30,0xc8}}',
    );
    expect(inspectUuid('{6BA7B810-9DAD-11D1-80B4-00C04FD430C8}')).toMatchObject({
      valid: true,
      version: 1,
    });
    expect(inspectUuid('6ba7b8109dad11d180b400c04fd430c8').valid).toBe(true);
    expect(inspectUuid('not-a-uuid').valid).toBe(false);
  });
});

describe('lorem ipsum', () => {
  it('generates words, sentences and paragraphs', () => {
    expect(generateLorem('words', 5)).toBe('Lorem ipsum dolor sit amet');
    expect(generateLorem('words', 12, false, seeded()).split(' ')).toHaveLength(12);
    expect(
      generateLorem('sentences', 3).startsWith(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      ),
    ).toBe(true);
    expect(generateLorem('paragraphs', 3).split('\n\n')).toHaveLength(3);
    expect(() => generateLorem('words', 0)).toThrow(ValidationError);
  });
});
