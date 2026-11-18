import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import { diffDates } from './dateDiff';
import { describeInstant, detectTimestampUnit, parseDateInput, parseTimestamp } from './timestamp';
import {
  describeInZone,
  formatOffset,
  listTimeZones,
  wallTimeToInstant,
  zoneOffsetMinutes,
} from './timezone';

const T = Date.UTC(2026, 10, 12, 14, 30, 0); // 2026-11-12T14:30:00Z (Thursday)

describe('timestamps', () => {
  it('detects units by magnitude and parses', () => {
    expect(
      [1_700_000_000, 1_700_000_000_000, 1_700_000_000_000_000, 1_700_000_000_000_000_000].map(
        detectTimestampUnit,
      ),
    ).toEqual(['s', 'ms', 'us', 'ns']);
    expect(parseTimestamp('1,700,000,000')).toEqual({ ms: 1_700_000_000_000, unit: 's' });
    expect(parseTimestamp('1700000000000', 's').ms).toBe(1_700_000_000_000_000);
    expect(parseTimestamp('-86400').ms).toBe(-86_400_000);
    expect(() => parseTimestamp('12abc')).toThrow(ValidationError);
    expect(() => parseTimestamp('1e30')).toThrow(/range/);
  });

  it('parses ISO, RFC 2822, zone-less wall times and "now"', () => {
    expect(parseDateInput('2026-11-12T14:30:00Z', 'Asia/Dubai')).toBe(T);
    expect(parseDateInput('2026-11-12 18:30', 'Asia/Dubai')).toBe(T);
    expect(parseDateInput('2026-11-12', 'UTC')).toBe(Date.UTC(2026, 10, 12));
    expect(parseDateInput('Thu, 12 Nov 2026 14:30:00 +0000', 'UTC')).toBe(T);
    expect(parseDateInput('now', 'UTC', 123)).toBe(123);
    expect(() => parseDateInput('2026-02-30', 'UTC')).toThrow(/does not exist/);
    expect(() => parseDateInput('someday', 'UTC')).toThrow(ValidationError);
  });

  it('describes an instant in a time zone', () => {
    const d = describeInstant(T, 'Asia/Kolkata', T + 3_600_000);
    expect(d).toMatchObject({
      unixSeconds: 1_794_493_800,
      isoUtc: '2026-11-12T14:30:00.000Z',
      isoInZone: '2026-11-12T20:00:00+05:30',
      rfc2822: 'Thu, 12 Nov 2026 14:30:00 +0000',
      relative: '1 hour ago',
      dayOfWeek: 'Thursday',
      isoWeek: 46,
      dayOfYear: 316,
      leapYear: false,
    });
  });
});

describe('time zones', () => {
  it('lists zones and formats offsets', () => {
    expect(listTimeZones()).toEqual(
      expect.arrayContaining(['UTC', 'Asia/Dubai', 'America/New_York']),
    );
    expect(formatOffset(330)).toBe('UTC+05:30');
    expect(formatOffset(-210)).toBe('UTC-03:30');
    expect(zoneOffsetMinutes('Asia/Dubai', T)).toBe(240);
  });

  it('converts wall times, including DST gaps and overlaps', () => {
    expect(wallTimeToInstant('2026-11-12T18:30', 'Asia/Dubai')).toEqual({ ms: T, note: null });
    const gap = wallTimeToInstant('2026-03-08T02:30', 'America/New_York');
    expect(gap.note).toMatch(/does not exist/);
    const overlap = wallTimeToInstant('2026-11-01T01:30', 'America/New_York');
    expect(overlap.note).toMatch(/occurs twice/);
    expect(() => wallTimeToInstant('2026-11-12T18:30', 'Mars/Olympus')).toThrow(
      /Unknown time zone/,
    );
  });

  it('describes an instant across zones with DST flag and day shift', () => {
    const ny = describeInZone(Date.UTC(2026, 6, 1, 2, 0), 'America/New_York', 'UTC');
    expect(ny).toMatchObject({ offset: 'UTC-04:00', dst: true, dayShift: -1, time: '22:00' });
    expect(describeInZone(T, 'Asia/Tokyo', 'UTC')).toMatchObject({
      dst: false,
      dayShift: 0,
      time: '23:30',
    });
  });
});

describe('date difference', () => {
  it('computes calendar parts, totals, business days and ISO duration', () => {
    const d = diffDates(Date.UTC(2024, 0, 31, 8), Date.UTC(2025, 2, 3, 10, 15, 30));
    expect(d.calendar).toEqual({
      years: 1,
      months: 1,
      days: 3,
      hours: 2,
      minutes: 15,
      seconds: 30,
    });
    expect(d.iso).toBe('P1Y1M3DT2H15M30S');
    expect(d.totals.days).toBe(397);
    expect(diffDates(Date.UTC(2026, 10, 9), Date.UTC(2026, 10, 16)).businessDays).toBe(5);
  });

  it('handles reversed and equal dates', () => {
    expect(diffDates(Date.UTC(2026, 0, 2), Date.UTC(2026, 0, 1))).toMatchObject({
      sign: -1,
      iso: '-P1D',
    });
    expect(diffDates(T, T).iso).toBe('PT0S');
  });
});
