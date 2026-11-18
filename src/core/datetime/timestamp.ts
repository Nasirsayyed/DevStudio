import { TZDate } from '@date-fns/tz';
import { formatDistanceStrict, getDayOfYear, getISOWeek, isLeapYear } from 'date-fns';
import { ValidationError } from '../errors/AppError';

export type TimestampUnit = 's' | 'ms' | 'us' | 'ns';

/** Infers the unit of a numeric epoch timestamp from its magnitude. */
export function detectTimestampUnit(value: number): TimestampUnit {
  const abs = Math.abs(value);
  if (abs < 1e11) return 's';
  if (abs < 1e14) return 'ms';
  if (abs < 1e17) return 'us';
  return 'ns';
}

const UNIT_TO_MS: Record<TimestampUnit, number> = { s: 1000, ms: 1, us: 1 / 1000, ns: 1 / 1e6 };

/** Parses an epoch timestamp ("1700000000", "1.7e9", "-86400"), auto-detecting or forcing the unit. */
export function parseTimestamp(
  input: string,
  unit: TimestampUnit | 'auto' = 'auto',
): { ms: number; unit: TimestampUnit } {
  const text = input.trim().replace(/[_,\s]/g, '');
  if (!/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(text))
    throw new ValidationError('Enter a numeric Unix timestamp, e.g. 1700000000.');
  const n = Number(text);
  const u = unit === 'auto' ? detectTimestampUnit(n) : unit;
  const ms = n * UNIT_TO_MS[u];
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15)
    throw new ValidationError('That timestamp is outside the representable date range.');
  return { ms, unit: u };
}

const WALL = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?$/;

/**
 * Parses a date/time string. Strings with an explicit offset or "Z" are
 * absolute; date-only and zone-less "YYYY-MM-DD HH:mm[:ss]" values are
 * interpreted in `timeZone`. Also accepts "now".
 */
export function parseDateInput(input: string, timeZone: string, now = Date.now()): number {
  const text = input.trim();
  if (!text)
    throw new ValidationError('Enter a date, e.g. 2026-11-12 14:30 or 2026-11-12T14:30:00Z.');
  if (/^now$/i.test(text)) return now;
  const wall = WALL.exec(text);
  if (wall) {
    const [, y, mo, d, h = '0', mi = '0', s = '0', frac = '0'] = wall;
    const month = Number(mo) - 1;
    const date = new TZDate(
      Number(y),
      month,
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
      Number(frac.padEnd(3, '0')),
      timeZone,
    );
    if (date.getMonth() !== month || date.getDate() !== Number(d))
      throw new ValidationError('That calendar date does not exist.');
    return date.getTime();
  }
  const ms = Date.parse(text);
  if (Number.isNaN(ms))
    throw new ValidationError(
      'Unrecognized date. Use ISO 8601 (2026-11-12T14:30:00Z) or RFC 2822.',
    );
  return ms;
}

export interface InstantDescription {
  unixSeconds: number;
  unixMilliseconds: number;
  isoUtc: string;
  /** ISO 8601 with the zone's offset. */
  isoInZone: string;
  /** Human-readable in the zone. */
  readable: string;
  rfc2822: string;
  relative: string;
  dayOfWeek: string;
  isoWeek: number;
  dayOfYear: number;
  leapYear: boolean;
}

export function describeInstant(
  ms: number,
  timeZone: string,
  now = Date.now(),
): InstantDescription {
  const zoned = new TZDate(ms, timeZone);
  const offsetMin = -zoned.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const off = `${sign}${String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0')}:${String(Math.abs(offsetMin) % 60).padStart(2, '0')}`;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const isoInZone = `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}T${pad(zoned.getHours())}:${pad(zoned.getMinutes())}:${pad(zoned.getSeconds())}${zoned.getMilliseconds() ? `.${pad(zoned.getMilliseconds(), 3)}` : ''}${off}`;
  const readable = new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(ms);
  const distance = formatDistanceStrict(ms, now);
  return {
    unixSeconds: Math.floor(ms / 1000),
    unixMilliseconds: Math.round(ms),
    isoUtc: new Date(ms).toISOString(),
    isoInZone,
    readable,
    rfc2822: new Date(ms).toUTCString().replace('GMT', '+0000'),
    relative: Math.abs(ms - now) < 1000 ? 'now' : ms > now ? `in ${distance}` : `${distance} ago`,
    dayOfWeek: new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(ms),
    isoWeek: getISOWeek(zoned),
    dayOfYear: getDayOfYear(zoned),
    leapYear: isLeapYear(zoned),
  };
}
