import { Alert, Grid, Paper, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import { diffDates } from '@/core/datetime/dateDiff';
import { wallTimeToInstant } from '@/core/datetime/timezone';
import { toUserMessage } from '@/core/errors/AppError';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { LOCAL_TIME_ZONE } from '../components/localZone';
import { ResultTable } from '../components/ResultRow';
import { TimeZoneSelect } from '../components/TimeZoneSelect';
import { UtilityPage } from '../components/UtilityPage';

const plural = (n: number, unit: string) => `${n.toLocaleString()} ${unit}${n === 1 ? '' : 's'}`;

export default function DateDiffPage() {
  const [opts, setOpts] = usePersistentOptions<{ zone: string }>('utils.date-diff', {
    zone: LOCAL_TIME_ZONE,
  });
  const [start, setStart] = useState('2026-01-01T09:00');
  const [end, setEnd] = useState('2026-12-31T17:30');

  let diff: ReturnType<typeof diffDates> | null = null;
  let error: string | null = null;
  try {
    diff = diffDates(
      wallTimeToInstant(start, opts.zone).ms,
      wallTimeToInstant(end, opts.zone).ms,
      opts.zone,
    );
  } catch (e) {
    error = toUserMessage(e);
  }
  const c = diff?.calendar;

  return (
    <UtilityPage toolId="utils.date-diff">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              size="small"
              type="datetime-local"
              label="Start"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
              }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              size="small"
              type="datetime-local"
              label="End"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
              }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TimeZoneSelect
              value={opts.zone}
              onChange={(zone) => {
                setOpts({ zone });
              }}
              width="100%"
            />
          </Grid>
        </Grid>
      </Paper>
      {error && <Alert severity="error">{error}</Alert>}
      {diff && c && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack spacing={1}>
            {diff.sign === -1 && (
              <Alert severity="info">
                The end is before the start; the difference is shown as negative.
              </Alert>
            )}
            <ResultTable
              ariaLabel="Difference"
              items={[
                {
                  label: 'Difference',
                  value:
                    [
                      c.years && plural(c.years, 'year'),
                      c.months && plural(c.months, 'month'),
                      c.days && plural(c.days, 'day'),
                      c.hours && plural(c.hours, 'hour'),
                      c.minutes && plural(c.minutes, 'minute'),
                      c.seconds && plural(c.seconds, 'second'),
                    ]
                      .filter(Boolean)
                      .join(', ') || 'No difference',
                  mono: false,
                },
                { label: 'ISO 8601 duration', value: diff.iso },
                { label: 'Total days', value: diff.totals.days.toLocaleString() },
                { label: 'Total weeks', value: diff.totals.weeks.toLocaleString() },
                { label: 'Total hours', value: diff.totals.hours.toLocaleString() },
                { label: 'Total minutes', value: diff.totals.minutes.toLocaleString() },
                { label: 'Total seconds', value: diff.totals.seconds.toLocaleString() },
                { label: 'Business days (Mon–Fri)', value: diff.businessDays.toLocaleString() },
              ]}
            />
          </Stack>
        </Paper>
      )}
    </UtilityPage>
  );
}
