import { Alert, Grid, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { SelectOption } from '@/components/workspace/OptionControls';
import {
  describeInstant,
  parseDateInput,
  parseTimestamp,
  type TimestampUnit,
} from '@/core/datetime/timestamp';
import { toUserMessage } from '@/core/errors/AppError';
import { useNow } from '@/hooks/useNow';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { fontFamilies } from '@/theme/tokens';
import { LOCAL_TIME_ZONE } from '../components/localZone';
import { ResultTable, ResultValue } from '../components/ResultRow';
import { TimeZoneSelect } from '../components/TimeZoneSelect';
import { UtilityPage } from '../components/UtilityPage';

const UNIT_LABEL: Record<TimestampUnit, string> = {
  s: 'seconds',
  ms: 'milliseconds',
  us: 'microseconds',
  ns: 'nanoseconds',
};

function Description({ ms, zone, now }: { ms: number; zone: string; now: number }) {
  const d = describeInstant(ms, zone, now);
  return (
    <ResultTable
      ariaLabel="Date details"
      items={[
        { label: 'Unix seconds', value: String(d.unixSeconds) },
        { label: 'Unix milliseconds', value: String(d.unixMilliseconds) },
        { label: 'ISO 8601 (UTC)', value: d.isoUtc },
        { label: `ISO 8601 (${zone})`, value: d.isoInZone },
        { label: 'Readable', value: d.readable, mono: false },
        { label: 'RFC 2822', value: d.rfc2822 },
        { label: 'Relative', value: d.relative, mono: false },
        {
          label: 'Calendar',
          value: `${d.dayOfWeek} · ISO week ${String(d.isoWeek)} · day ${String(d.dayOfYear)}${d.leapYear ? ' · leap year' : ''}`,
          mono: false,
        },
      ]}
    />
  );
}

export default function UnixTimestampPage() {
  const now = useNow(1000);
  const [opts, setOpts] = usePersistentOptions<{ zone: string; unit: TimestampUnit | 'auto' }>(
    'utils.unix-timestamp',
    { zone: LOCAL_TIME_ZONE, unit: 'auto' },
  );
  const [ts, setTs] = useState('');
  const [dateText, setDateText] = useState('');

  let fromTs: { ms: number; unit: TimestampUnit } | null = null;
  let tsError: string | null = null;
  try {
    fromTs = ts.trim() ? parseTimestamp(ts, opts.unit) : null;
  } catch (e) {
    tsError = toUserMessage(e);
  }
  let fromDate: number | null = null;
  let dateError: string | null = null;
  try {
    fromDate = dateText.trim() ? parseDateInput(dateText, opts.zone, now) : null;
  } catch (e) {
    dateError = toUserMessage(e);
  }

  return (
    <UtilityPage
      toolId="utils.unix-timestamp"
      toolbar={
        <TimeZoneSelect
          value={opts.zone}
          onChange={(zone) => {
            setOpts({ zone });
          }}
          label="Display time zone"
          width={300}
        />
      }
    >
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
          Now
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ResultValue label="Unix seconds" value={String(Math.floor(now / 1000))} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ResultValue label="Unix milliseconds" value={String(now)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ResultValue
              label="ISO 8601 (UTC)"
              value={new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z')}
            />
          </Grid>
        </Grid>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" component="h2">
            Timestamp → date
          </Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              label="Unix timestamp"
              value={ts}
              onChange={(e) => {
                setTs(e.target.value);
              }}
              placeholder="1700000000"
              sx={{ flex: 1 }}
              slotProps={{
                htmlInput: { style: { fontFamily: fontFamilies.mono }, inputMode: 'numeric' },
              }}
            />
            <SelectOption
              label="Unit"
              value={opts.unit}
              options={[
                { value: 'auto', label: 'Auto-detect' },
                { value: 's', label: 'Seconds' },
                { value: 'ms', label: 'Milliseconds' },
                { value: 'us', label: 'Microseconds' },
                { value: 'ns', label: 'Nanoseconds' },
              ]}
              onChange={(unit) => {
                setOpts({ unit });
              }}
              width={160}
            />
          </Stack>
          {tsError && <Alert severity="error">{tsError}</Alert>}
          {fromTs && (
            <>
              <Typography variant="caption" color="text.secondary">
                Interpreted as {UNIT_LABEL[fromTs.unit]}.
              </Typography>
              <Description ms={fromTs.ms} zone={opts.zone} now={now} />
            </>
          )}
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" component="h2">
            Date → timestamp
          </Typography>
          <TextField
            size="small"
            label="Date and time"
            value={dateText}
            onChange={(e) => {
              setDateText(e.target.value);
            }}
            placeholder="2026-11-12 14:30, 2026-11-12T14:30:00Z, now"
            helperText={`Values without an offset are read in ${opts.zone}.`}
            slotProps={{ htmlInput: { style: { fontFamily: fontFamilies.mono } } }}
          />
          {dateError && <Alert severity="error">{dateError}</Alert>}
          {fromDate !== null && <Description ms={fromDate} zone={opts.zone} now={now} />}
        </Stack>
      </Paper>
    </UtilityPage>
  );
}
