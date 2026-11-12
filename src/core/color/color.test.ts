import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import {
  contrast,
  namedColor,
  parseColor,
  toCmyk,
  toHex,
  toHsl,
  toHslString,
  toHsv,
  toRgbString,
} from './color';

describe('parseColor', () => {
  it.each([
    ['#4f46e5', { r: 79, g: 70, b: 229, a: 1 }],
    ['4F46E5', { r: 79, g: 70, b: 229, a: 1 }],
    ['#fff', { r: 255, g: 255, b: 255, a: 1 }],
    ['#0008', { r: 0, g: 0, b: 0, a: 0.533 }],
    ['#ff000080', { r: 255, g: 0, b: 0, a: 0.502 }],
    ['rgb(79, 70, 229)', { r: 79, g: 70, b: 229, a: 1 }],
    ['rgb(79 70 229 / 50%)', { r: 79, g: 70, b: 229, a: 0.5 }],
    ['rgba(100%, 0%, 0%, 0.25)', { r: 255, g: 0, b: 0, a: 0.25 }],
    ['hsl(0, 100%, 50%)', { r: 255, g: 0, b: 0, a: 1 }],
    ['hsl(0.5turn 100% 25%)', { r: 0, g: 128, b: 128, a: 1 }],
    ['RebeccaPurple', { r: 102, g: 51, b: 153, a: 1 }],
    ['transparent', { r: 0, g: 0, b: 0, a: 0 }],
  ])('%s', (input, expected) => {
    expect(parseColor(input)).toEqual(expected);
  });

  it.each(['', '#12', '#ggg', 'rgb(1,2)', 'hsl(x, 1%, 1%)', 'blurple'])('rejects %j', (input) => {
    expect(() => parseColor(input)).toThrow(ValidationError);
  });
});

describe('conversions', () => {
  const indigo = parseColor('#4f46e5');
  it('converts to every format', () => {
    expect(toHex(indigo)).toBe('#4f46e5');
    expect(toHex(indigo, true)).toBe('#4f46e5ff');
    expect(toRgbString(indigo)).toBe('rgb(79, 70, 229)');
    expect(toHsl(indigo)).toEqual({ h: 243.4, s: 75.4, l: 58.6 });
    expect(toHslString({ ...indigo, a: 0.5 })).toBe('hsla(243.4, 75.4%, 58.6%, 0.5)');
    expect(toHsv(indigo)).toEqual({ h: 243.4, s: 69.4, v: 89.8 });
    expect(toCmyk(indigo)).toEqual({ c: 65.5, m: 69.4, y: 0, k: 10.2 });
    expect(toCmyk(parseColor('black'))).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(namedColor(parseColor('#663399'))).toBe('rebeccapurple');
    expect(namedColor(indigo)).toBeNull();
  });

  it('computes WCAG contrast', () => {
    expect(contrast(parseColor('black'), parseColor('white'))).toEqual({
      ratio: 21,
      aa: true,
      aaLarge: true,
      aaa: true,
      aaaLarge: true,
    });
    expect(contrast(parseColor('#777'), parseColor('white'))).toMatchObject({
      ratio: 4.48,
      aa: false,
      aaLarge: true,
    });
  });
});
