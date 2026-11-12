import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import { analyzeCron } from './cron';

const from = new Date('2026-11-12T00:00:00Z');

describe('analyzeCron', () => {
  it('describes and lists next runs in a time zone', () => {
    const r = analyzeCron('0 9 * * 1-5', { timeZone: 'Asia/Dubai', from, count: 3 });
    expect(r.description).toBe('At 09:00, Monday through Friday');
    expect(r.nextRuns.map((d) => d.toISOString())).toEqual([
      '2026-11-12T05:00:00.000Z',
      '2026-11-13T05:00:00.000Z',
      '2026-11-16T05:00:00.000Z',
    ]);
    expect(r.fields.map((f) => [f.name, f.value])).toEqual([
      ['Minute', '0'],
      ['Hour', '9'],
      ['Day of month', '*'],
      ['Month', '*'],
      ['Day of week', '1-5'],
    ]);
  });

  it('supports seconds, macros, L and #', () => {
    expect(analyzeCron('*/15 * * * * *', { timeZone: 'UTC', from, count: 2 })).toMatchObject({
      hasSeconds: true,
    });
    expect(
      analyzeCron('@daily', { timeZone: 'UTC', from, count: 1 }).nextRuns[0]?.toISOString(),
    ).toBe('2026-11-13T00:00:00.000Z');
    expect(
      analyzeCron('0 18 L * *', { timeZone: 'UTC', from, count: 1 }).nextRuns[0]?.toISOString(),
    ).toBe('2026-11-30T18:00:00.000Z');
    expect(
      analyzeCron('0 0 * * MON#2', { timeZone: 'UTC', from, count: 1 }).nextRuns[0]?.toISOString(),
    ).toBe('2026-12-14T00:00:00.000Z');
  });

  it.each([
    ['', /Enter a cron/],
    ['* * *', /has 3/],
    ['61 * * * *', /Invalid cron expression/],
    ['0 0 30 2 *', /Invalid cron expression/],
  ])('rejects %j', (expr, message) => {
    expect(() => analyzeCron(expr, { timeZone: 'UTC', from })).toThrow(ValidationError);
    expect(() => analyzeCron(expr, { timeZone: 'UTC', from })).toThrow(message);
  });
});
