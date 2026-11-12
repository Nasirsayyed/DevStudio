import { TZDate } from '@date-fns/tz';
import { differenceInBusinessDays, intervalToDuration } from 'date-fns';

export interface DateDifference {
  /** -1 when the end is before the start. */
  sign: 1 | -1;
  calendar: {
    years: number;
    months: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
  totals: {
    weeks: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
  };
  /** Monday–Friday days between the dates (holidays not considered). */
  businessDays: number;
  /** ISO 8601 duration, e.g. P1Y2M3DT4H5M6S. */
  iso: string;
}

/** Calendar-aware difference between two instants, evaluated in a time zone. */
export function diffDates(startMs: number, endMs: number, timeZone = 'UTC'): DateDifference {
  const sign: 1 | -1 = endMs >= startMs ? 1 : -1;
  const [a, b] = sign === 1 ? [startMs, endMs] : [endMs, startMs];
  const start = new TZDate(a, timeZone);
  const end = new TZDate(b, timeZone);
  const d = intervalToDuration({ start, end });
  const calendar = {
    years: d.years ?? 0,
    months: d.months ?? 0,
    days: d.days ?? 0,
    hours: d.hours ?? 0,
    minutes: d.minutes ?? 0,
    seconds: d.seconds ?? 0,
  };
  const ms = b - a;
  const totals = {
    weeks: Math.floor(ms / 604_800_000),
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000),
    minutes: Math.floor(ms / 60_000),
    seconds: Math.floor(ms / 1000),
    milliseconds: ms,
  };
  const datePart = `${calendar.years ? `${calendar.years}Y` : ''}${calendar.months ? `${calendar.months}M` : ''}${calendar.days ? `${calendar.days}D` : ''}`;
  const timePart = `${calendar.hours ? `${calendar.hours}H` : ''}${calendar.minutes ? `${calendar.minutes}M` : ''}${calendar.seconds ? `${calendar.seconds}S` : ''}`;
  const body = `${datePart}${timePart ? `T${timePart}` : ''}`;
  const iso = body ? `${sign === -1 ? '-' : ''}P${body}` : 'PT0S';
  return {
    sign,
    calendar,
    totals,
    businessDays: Math.abs(differenceInBusinessDays(end, start)),
    iso,
  };
}
