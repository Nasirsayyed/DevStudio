import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue';
import { ValidationError } from '../errors/AppError';

export interface CronField {
  name: string;
  value: string;
  allowed: string;
}

export interface CronAnalysis {
  description: string;
  nextRuns: Date[];
  fields: CronField[];
  hasSeconds: boolean;
}

const FIELD_INFO: [string, string][] = [
  ['Minute', '0–59'],
  ['Hour', '0–23'],
  ['Day of month', '1–31, L, W'],
  ['Month', '1–12 or JAN–DEC'],
  ['Day of week', '0–7 or SUN–SAT (0 and 7 = Sunday), L, #'],
];

export const CRON_PRESETS: readonly { label: string; expression: string }[] = [
  { label: 'Every minute', expression: '* * * * *' },
  { label: 'Every 5 minutes', expression: '*/5 * * * *' },
  { label: 'Every hour', expression: '0 * * * *' },
  { label: 'Every day at midnight', expression: '0 0 * * *' },
  { label: 'Weekdays at 09:00', expression: '0 9 * * 1-5' },
  { label: 'Every Sunday at 03:30', expression: '30 3 * * 0' },
  { label: 'First day of the month', expression: '0 0 1 * *' },
  { label: 'Last day of the month at 18:00', expression: '0 18 L * *' },
  { label: 'Every 15 seconds (6 fields)', expression: '*/15 * * * * *' },
];

/** Validates (cron-parser), describes (cronstrue) and lists upcoming runs of a cron expression. */
export function analyzeCron(
  expression: string,
  options: { timeZone: string; count?: number; from?: Date; use24HourTime?: boolean },
): CronAnalysis {
  const expr = expression.trim().replace(/\s+/g, ' ');
  if (!expr) throw new ValidationError('Enter a cron expression, e.g. "*/5 * * * *".');
  const macro = expr.startsWith('@');
  const parts = macro ? [] : expr.split(' ');
  if (!macro && (parts.length < 5 || parts.length > 6)) {
    throw new ValidationError(
      `A cron expression has 5 fields (or 6 with seconds); this has ${parts.length}.`,
    );
  }
  let interval;
  try {
    interval = CronExpressionParser.parse(expr, {
      tz: options.timeZone,
      currentDate: options.from ?? new Date(),
    });
  } catch (error) {
    throw new ValidationError(
      `Invalid cron expression: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const nextRuns: Date[] = [];
  const count = options.count ?? 10;
  try {
    for (let i = 0; i < count; i++) nextRuns.push(interval.next().toDate());
  } catch {
    // Expressions like "0 0 30 2 *" never match: stop listing.
  }
  let description: string;
  try {
    description = cronstrue.toString(expr, {
      throwExceptionOnParseError: true,
      use24HourTimeFormat: options.use24HourTime ?? true,
      verbose: true,
    });
  } catch (error) {
    description = `(no description: ${error instanceof Error ? error.message : String(error)})`;
  }
  const hasSeconds = parts.length === 6;
  const fieldNames = hasSeconds
    ? [['Second', '0–59'] as [string, string], ...FIELD_INFO]
    : FIELD_INFO;
  return {
    description,
    nextRuns,
    hasSeconds,
    fields: parts.map((value, i) => ({
      name: fieldNames[i]?.[0] ?? '',
      allowed: fieldNames[i]?.[1] ?? '',
      value,
    })),
  };
}
