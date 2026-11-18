import { TZDate } from '@date-fns/tz';
import { ValidationError } from '../errors/AppError';

/** All IANA time zones supported by the runtime (plus UTC). */
export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = intl.supportedValuesOf?.('timeZone') ?? [];
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** UTC offset of a zone at an instant, in minutes (e.g. +240 for Asia/Dubai). */
export function zoneOffsetMinutes(zone: string, ms: number): number {
  return -new TZDate(ms, zone).getTimezoneOffset();
}

export function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export interface ZonedTime {
  zone: string;
  date: string;
  time: string;
  weekday: string;
  offset: string;
  abbreviation: string;
  /** Daylight-saving time is in effect. */
  dst: boolean;
  /** Calendar day difference relative to the source zone (-1, 0, +1). */
  dayShift: number;
}

export function describeInZone(ms: number, zone: string, referenceZone?: string): ZonedTime {
  if (!isValidTimeZone(zone)) throw new ValidationError(`Unknown time zone "${zone}".`);
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone: zone, ...o }).format(ms);
  const offset = zoneOffsetMinutes(zone, ms);
  const year = new TZDate(ms, zone).getFullYear();
  const jan = zoneOffsetMinutes(zone, Date.UTC(year, 0, 1));
  const jul = zoneOffsetMinutes(zone, Date.UTC(year, 6, 1));
  const abbreviation =
    new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(ms)
      .find((p) => p.type === 'timeZoneName')?.value ?? '';
  let dayShift = 0;
  if (referenceZone) {
    const day = (z: string) => {
      const d = new TZDate(ms, z);
      return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    };
    dayShift = Math.round((day(zone) - day(referenceZone)) / 86_400_000);
  }
  return {
    zone,
    date: fmt({ year: 'numeric', month: 'short', day: 'numeric' }),
    time: fmt({ hour: '2-digit', minute: '2-digit', hour12: false }),
    weekday: fmt({ weekday: 'short' }),
    offset: formatOffset(offset),
    abbreviation,
    dst: jan !== jul && offset === Math.max(jan, jul),
    dayShift,
  };
}

/**
 * Converts a wall-clock time ("YYYY-MM-DDTHH:mm") in `zone` to an instant.
 * Reports times that don't exist (DST gap) or occur twice (DST overlap).
 */
export function wallTimeToInstant(wall: string, zone: string): { ms: number; note: string | null } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wall.trim());
  if (!m) throw new ValidationError('Enter a date and time.');
  if (!isValidTimeZone(zone)) throw new ValidationError(`Unknown time zone "${zone}".`);
  const [, y, mo, day, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const date = new TZDate(y, mo - 1, day, h, mi, 0, 0, zone);
  const ms = date.getTime();
  let note: string | null = null;
  if (date.getHours() !== h || date.getMinutes() !== mi) {
    note = `${wall.replace('T', ' ')} does not exist in ${zone} (clocks skip forward for daylight saving); shown as ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}.`;
  } else {
    // Ambiguous wall time (clocks fall back): the same clock reading exists one hour apart.
    const sameWall = (t: number) => {
      const d = new TZDate(t, zone);
      return d.getHours() === h && d.getMinutes() === mi && d.getDate() === day;
    };
    if (sameWall(ms + 3_600_000))
      note = `${wall.replace('T', ' ')} occurs twice in ${zone} (clocks fall back); the first occurrence is used.`;
    else if (sameWall(ms - 3_600_000))
      note = `${wall.replace('T', ' ')} occurs twice in ${zone} (clocks fall back); the second occurrence is used.`;
  }
  return { ms, note };
}
