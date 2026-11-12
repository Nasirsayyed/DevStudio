import { ValidationError } from '../errors/AppError';

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0–1 */
  a: number;
}

/** CSS Color Module Level 4 named colors. */
export const NAMED_COLORS: Readonly<Record<string, string>> = {
  aliceblue: 'f0f8ff',
  antiquewhite: 'faebd7',
  aqua: '00ffff',
  aquamarine: '7fffd4',
  azure: 'f0ffff',
  beige: 'f5f5dc',
  bisque: 'ffe4c4',
  black: '000000',
  blanchedalmond: 'ffebcd',
  blue: '0000ff',
  blueviolet: '8a2be2',
  brown: 'a52a2a',
  burlywood: 'deb887',
  cadetblue: '5f9ea0',
  chartreuse: '7fff00',
  chocolate: 'd2691e',
  coral: 'ff7f50',
  cornflowerblue: '6495ed',
  cornsilk: 'fff8dc',
  crimson: 'dc143c',
  cyan: '00ffff',
  darkblue: '00008b',
  darkcyan: '008b8b',
  darkgoldenrod: 'b8860b',
  darkgray: 'a9a9a9',
  darkgreen: '006400',
  darkgrey: 'a9a9a9',
  darkkhaki: 'bdb76b',
  darkmagenta: '8b008b',
  darkolivegreen: '556b2f',
  darkorange: 'ff8c00',
  darkorchid: '9932cc',
  darkred: '8b0000',
  darksalmon: 'e9967a',
  darkseagreen: '8fbc8f',
  darkslateblue: '483d8b',
  darkslategray: '2f4f4f',
  darkslategrey: '2f4f4f',
  darkturquoise: '00ced1',
  darkviolet: '9400d3',
  deeppink: 'ff1493',
  deepskyblue: '00bfff',
  dimgray: '696969',
  dimgrey: '696969',
  dodgerblue: '1e90ff',
  firebrick: 'b22222',
  floralwhite: 'fffaf0',
  forestgreen: '228b22',
  fuchsia: 'ff00ff',
  gainsboro: 'dcdcdc',
  ghostwhite: 'f8f8ff',
  gold: 'ffd700',
  goldenrod: 'daa520',
  gray: '808080',
  green: '008000',
  greenyellow: 'adff2f',
  grey: '808080',
  honeydew: 'f0fff0',
  hotpink: 'ff69b4',
  indianred: 'cd5c5c',
  indigo: '4b0082',
  ivory: 'fffff0',
  khaki: 'f0e68c',
  lavender: 'e6e6fa',
  lavenderblush: 'fff0f5',
  lawngreen: '7cfc00',
  lemonchiffon: 'fffacd',
  lightblue: 'add8e6',
  lightcoral: 'f08080',
  lightcyan: 'e0ffff',
  lightgoldenrodyellow: 'fafad2',
  lightgray: 'd3d3d3',
  lightgreen: '90ee90',
  lightgrey: 'd3d3d3',
  lightpink: 'ffb6c1',
  lightsalmon: 'ffa07a',
  lightseagreen: '20b2aa',
  lightskyblue: '87cefa',
  lightslategray: '778899',
  lightslategrey: '778899',
  lightsteelblue: 'b0c4de',
  lightyellow: 'ffffe0',
  lime: '00ff00',
  limegreen: '32cd32',
  linen: 'faf0e6',
  magenta: 'ff00ff',
  maroon: '800000',
  mediumaquamarine: '66cdaa',
  mediumblue: '0000cd',
  mediumorchid: 'ba55d3',
  mediumpurple: '9370db',
  mediumseagreen: '3cb371',
  mediumslateblue: '7b68ee',
  mediumspringgreen: '00fa9a',
  mediumturquoise: '48d1cc',
  mediumvioletred: 'c71585',
  midnightblue: '191970',
  mintcream: 'f5fffa',
  mistyrose: 'ffe4e1',
  moccasin: 'ffe4b5',
  navajowhite: 'ffdead',
  navy: '000080',
  oldlace: 'fdf5e6',
  olive: '808000',
  olivedrab: '6b8e23',
  orange: 'ffa500',
  orangered: 'ff4500',
  orchid: 'da70d6',
  palegoldenrod: 'eee8aa',
  palegreen: '98fb98',
  paleturquoise: 'afeeee',
  palevioletred: 'db7093',
  papayawhip: 'ffefd5',
  peachpuff: 'ffdab9',
  peru: 'cd853f',
  pink: 'ffc0cb',
  plum: 'dda0dd',
  powderblue: 'b0e0e6',
  purple: '800080',
  rebeccapurple: '663399',
  red: 'ff0000',
  rosybrown: 'bc8f8f',
  royalblue: '4169e1',
  saddlebrown: '8b4513',
  salmon: 'fa8072',
  sandybrown: 'f4a460',
  seagreen: '2e8b57',
  seashell: 'fff5ee',
  sienna: 'a0522d',
  silver: 'c0c0c0',
  skyblue: '87ceeb',
  slateblue: '6a5acd',
  slategray: '708090',
  slategrey: '708090',
  snow: 'fffafa',
  springgreen: '00ff7f',
  steelblue: '4682b4',
  tan: 'd2b48c',
  teal: '008080',
  thistle: 'd8bfd8',
  tomato: 'ff6347',
  turquoise: '40e0d0',
  violet: 'ee82ee',
  wheat: 'f5deb3',
  white: 'ffffff',
  whitesmoke: 'f5f5f5',
  yellow: 'ffff00',
  yellowgreen: '9acd32',
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function parseHex(hex: string): Rgba | null {
  const h = hex.replace(/^#/, '');
  if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(h)) return null;
  const full = h.length <= 4 ? Array.from(h, (c) => c + c).join('') : h;
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
  return {
    r: n(0),
    g: n(2),
    b: n(4),
    a: full.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1,
  };
}

function parseAlpha(v: string | undefined): number {
  if (v === undefined) return 1;
  return clamp(v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v), 0, 1);
}

function parseHue(v: string): number {
  const n = parseFloat(v);
  if (v.endsWith('turn')) return n * 360;
  if (v.endsWith('rad')) return (n * 180) / Math.PI;
  if (v.endsWith('grad')) return n * 0.9;
  return n;
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = (((h % 360) + 360) % 360) / 360;
  const f = (n: number) => {
    const k = (n + hue * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return { r: f(0), g: f(8), b: f(4) };
}

/** Parses HEX, rgb()/rgba(), hsl()/hsla() (comma or space syntax) and CSS named colors. */
export function parseColor(input: string): Rgba {
  const text = input.trim().toLowerCase();
  if (!text)
    throw new ValidationError(
      'Enter a color, e.g. #4f46e5, rgb(79 70 229), hsl(243 75% 59%) or rebeccapurple.',
    );
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const named = NAMED_COLORS[text];
  if (named) return parseHex(named) as Rgba;
  const hex = parseHex(
    text.startsWith('#') ? text : /^[0-9a-f]{3,8}$/.test(text) ? `#${text}` : '',
  );
  if (hex) return hex;
  const fn = /^(rgba?|hsla?)\(\s*([^)]*)\)$/.exec(text);
  if (fn) {
    const parts = (fn[2] ?? '').split(/\s*,\s*|\s*\/\s*|\s+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4)
      throw new ValidationError(`${fn[1] ?? ''}() needs 3 values and an optional alpha.`);
    const [p0 = '', p1 = '', p2 = '', p3] = parts;
    if (fn[1]?.startsWith('rgb')) {
      const ch = (v: string) =>
        Math.round(clamp(v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v), 0, 255));
      const rgb = { r: ch(p0), g: ch(p1), b: ch(p2), a: parseAlpha(p3) };
      if ([rgb.r, rgb.g, rgb.b, rgb.a].some(Number.isNaN))
        throw new ValidationError('Invalid number in rgb().');
      return rgb;
    }
    const s = clamp(parseFloat(p1) / 100, 0, 1);
    const l = clamp(parseFloat(p2) / 100, 0, 1);
    const h = parseHue(p0);
    if ([h, s, l].some(Number.isNaN)) throw new ValidationError('Invalid number in hsl().');
    return { ...hslToRgb(h, s, l), a: parseAlpha(p3) };
  }
  throw new ValidationError(`"${input.trim()}" is not a recognized color.`);
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function toHex(c: Rgba, forceAlpha = false): string {
  const base = `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  return c.a < 1 || forceAlpha ? `${base}${hex2(Math.round(c.a * 255))}` : base;
}

export function toRgbString(c: Rgba): string {
  return c.a < 1 ? `rgba(${c.r}, ${c.g}, ${c.b}, ${round(c.a, 3)})` : `rgb(${c.r}, ${c.g}, ${c.b})`;
}

export function toHsl(c: Rgba): { h: number; s: number; l: number } {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: round((h * 60 + 360) % 360), s: round(s * 100), l: round(l * 100) };
}

export function toHslString(c: Rgba): string {
  const { h, s, l } = toHsl(c);
  return c.a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${round(c.a, 3)})` : `hsl(${h}, ${s}%, ${l}%)`;
}

export function toHsv(c: Rgba): { h: number; s: number; v: number } {
  const max = Math.max(c.r, c.g, c.b) / 255;
  const min = Math.min(c.r, c.g, c.b) / 255;
  return {
    h: toHsl(c).h,
    s: round(max === 0 ? 0 : ((max - min) / max) * 100),
    v: round(max * 100),
  };
}

export function toCmyk(c: Rgba): { c: number; m: number; y: number; k: number } {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: round(((1 - r - k) / (1 - k)) * 100),
    m: round(((1 - g - k) / (1 - k)) * 100),
    y: round(((1 - b - k) / (1 - k)) * 100),
    k: round(k * 100),
  };
}

export function namedColor(c: Rgba): string | null {
  if (c.a < 1) return null;
  const hex = toHex(c).slice(1);
  return Object.keys(NAMED_COLORS).find((n) => NAMED_COLORS[n] === hex) ?? null;
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(c: Rgba): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

export interface Contrast {
  ratio: number;
  aa: boolean;
  aaLarge: boolean;
  aaa: boolean;
  aaaLarge: boolean;
}

/** WCAG contrast ratio between two opaque colors. */
export function contrast(a: Rgba, b: Rgba): Contrast {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  const ratio = Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
  return { ratio, aa: ratio >= 4.5, aaLarge: ratio >= 3, aaa: ratio >= 7, aaaLarge: ratio >= 4.5 };
}
