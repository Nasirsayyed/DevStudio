import {
  Alert,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import { Trash } from 'iconsax-reactjs';
import { useState } from 'react';
import { describeInZone, wallTimeToInstant } from '@/core/datetime/timezone';
import { toUserMessage } from '@/core/errors/AppError';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { LOCAL_TIME_ZONE } from '../components/localZone';
import { TimeZoneSelect } from '../components/TimeZoneSelect';
import { UtilityPage } from '../components/UtilityPage';

const DEFAULT_TARGETS = [
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function wallNow(zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export default function TimezonePage() {
  const [opts, setOpts] = usePersistentOptions<{ source: string; targets: string[] }>(
    'utils.timezone',
    { source: LOCAL_TIME_ZONE, targets: DEFAULT_TARGETS },
  );
  const [wall, setWall] = useState(() => wallNow(opts.source));
  const [adding, setAdding] = useState('Europe/Berlin');

  let instant: { ms: number; note: string | null } | null = null;
  let error: string | null = null;
  try {
    instant = wallTimeToInstant(wall, opts.source);
  } catch (e) {
    error = toUserMessage(e);
  }

  return (
    <UtilityPage toolId="utils.timezone">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' } }}
        >
          <TextField
            size="small"
            type="datetime-local"
            label="Date and time"
            value={wall}
            onChange={(e) => {
              setWall(e.target.value);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TimeZoneSelect
            label="In time zone"
            value={opts.source}
            onChange={(source) => {
              setOpts({ source });
            }}
            width={280}
          />
          <Button
            onClick={() => {
              setWall(wallNow(opts.source));
            }}
          >
            Now
          </Button>
        </Stack>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {instant?.note && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {instant.note}
          </Alert>
        )}
      </Paper>
      {instant && (
        <Paper variant="outlined" sx={{ borderRadius: 3, overflowX: 'auto' }}>
          <Table size="small" aria-label="Converted times">
            <TableHead>
              <TableRow>
                <TableCell>Time zone</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Offset</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {opts.targets.map((zone) => {
                const z = describeInZone(instant.ms, zone, opts.source);
                return (
                  <TableRow key={zone}>
                    <TableCell>
                      {zone}
                      {zone === opts.source && <Chip size="small" label="source" sx={{ ml: 1 }} />}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: 15 }}>
                      {z.time}
                      {z.dayShift !== 0 && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={
                            z.dayShift > 0
                              ? `+${String(z.dayShift)} day`
                              : `${String(z.dayShift)} day`
                          }
                          sx={{ ml: 1 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {z.weekday}, {z.date}
                    </TableCell>
                    <TableCell>
                      {z.offset} {z.abbreviation && `(${z.abbreviation})`}
                      {z.dst && (
                        <Chip
                          size="small"
                          color="info"
                          variant="outlined"
                          label="DST"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Remove">
                        <IconButton
                          size="small"
                          aria-label={`Remove ${zone}`}
                          onClick={() => {
                            setOpts({ targets: opts.targets.filter((t) => t !== zone) });
                          }}
                        >
                          <Trash size={16} color="currentColor" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Stack direction="row" spacing={1} sx={{ p: 1.5, alignItems: 'center' }}>
            <TimeZoneSelect label="Add time zone" value={adding} onChange={setAdding} width={280} />
            <Button
              disabled={opts.targets.includes(adding)}
              onClick={() => {
                setOpts({ targets: [...opts.targets, adding] });
              }}
            >
              Add
            </Button>
          </Stack>
        </Paper>
      )}
    </UtilityPage>
  );
}
