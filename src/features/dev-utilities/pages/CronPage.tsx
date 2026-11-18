import {
  Alert,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { formatDistanceStrict } from 'date-fns';
import { useState } from 'react';
import { analyzeCron, CRON_PRESETS } from '@/core/cron/cron';
import { toUserMessage } from '@/core/errors/AppError';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useNow } from '@/hooks/useNow';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { fontFamilies } from '@/theme/tokens';
import { LOCAL_TIME_ZONE } from '../components/localZone';
import { TimeZoneSelect } from '../components/TimeZoneSelect';
import { UtilityPage } from '../components/UtilityPage';

export default function CronPage() {
  const [opts, setOpts] = usePersistentOptions<{
    expression: string;
    zone: string;
    use24h: boolean;
  }>('utils.cron', { expression: '0 9 * * 1-5', zone: LOCAL_TIME_ZONE, use24h: true });
  const [expression, setExpression] = useState(opts.expression);
  const debounced = useDebouncedValue(expression, 200);
  const now = useNow(30_000);

  let analysis: ReturnType<typeof analyzeCron> | null = null;
  let error: string | null = null;
  try {
    analysis = analyzeCron(debounced, {
      timeZone: opts.zone,
      count: 10,
      from: new Date(now),
      use24HourTime: opts.use24h,
    });
  } catch (e) {
    error = toUserMessage(e);
  }
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: opts.zone,
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: !opts.use24h,
  });

  return (
    <UtilityPage toolId="utils.cron">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={2}>
          <TextField
            label="Cron expression"
            value={expression}
            onChange={(e) => {
              setExpression(e.target.value);
              setOpts({ expression: e.target.value });
            }}
            helperText="minute hour day-of-month month day-of-week (optional leading seconds field), or @hourly / @daily / @weekly / @monthly / @yearly"
            slotProps={{
              htmlInput: {
                spellCheck: false,
                style: { fontFamily: fontFamilies.mono, fontSize: 18 },
              },
            }}
          />
          <Stack
            direction="row"
            spacing={0.75}
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
            aria-label="Presets"
          >
            {CRON_PRESETS.map((p) => (
              <Chip
                key={p.expression}
                size="small"
                variant="outlined"
                label={p.label}
                onClick={() => {
                  setExpression(p.expression);
                  setOpts({ expression: p.expression });
                }}
              />
            ))}
          </Stack>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <TimeZoneSelect
              value={opts.zone}
              onChange={(zone) => {
                setOpts({ zone });
              }}
              width={280}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={opts.use24h}
                  onChange={(e) => {
                    setOpts({ use24h: e.target.checked });
                  }}
                />
              }
              label="24-hour clock"
            />
          </Stack>
        </Stack>
      </Paper>
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
      {analysis && (
        <>
          <Alert severity="info" icon={false} sx={{ borderRadius: 3 }}>
            <Typography variant="h5" component="p" aria-label="Description">
              {analysis.description}
            </Typography>
          </Alert>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflowX: 'auto' }}>
            <Table size="small" aria-label="Fields">
              <TableHead>
                <TableRow>
                  {analysis.fields.map((f) => (
                    <TableCell key={f.name}>{f.name}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  {analysis.fields.map((f) => (
                    <TableCell key={f.name} sx={{ fontFamily: fontFamilies.mono, fontSize: 16 }}>
                      {f.value}
                      <Typography variant="caption" color="text.secondary" component="div">
                        {f.allowed}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
              Next runs ({opts.zone})
            </Typography>
            {analysis.nextRuns.length === 0 ? (
              <Alert severity="warning">This expression never matches a real date.</Alert>
            ) : (
              <Stack component="ol" spacing={0.5} aria-label="Next runs" sx={{ m: 0, pl: 3 }}>
                {analysis.nextRuns.map((d) => (
                  <li key={d.getTime()}>
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{ fontFamily: fontFamilies.mono }}
                    >
                      {fmt.format(d)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="span"
                      sx={{ ml: 1 }}
                    >
                      {formatDistanceStrict(d, now, { addSuffix: true })}
                    </Typography>
                  </li>
                ))}
              </Stack>
            )}
          </Paper>
        </>
      )}
    </UtilityPage>
  );
}
