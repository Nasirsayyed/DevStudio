import { Autocomplete, TextField } from '@mui/material';
import { useMemo } from 'react';
import { listTimeZones } from '@/core/datetime/timezone';
import { LOCAL_TIME_ZONE } from './localZone';

/** Searchable IANA time zone picker (local zone and UTC listed first). */
export function TimeZoneSelect({
  label = 'Time zone',
  value,
  onChange,
  width = 260,
}: {
  label?: string;
  value: string;
  onChange: (zone: string) => void;
  width?: number | string;
}) {
  const zones = useMemo(() => {
    const all = listTimeZones();
    return [LOCAL_TIME_ZONE, 'UTC', ...all.filter((z) => z !== LOCAL_TIME_ZONE && z !== 'UTC')];
  }, []);
  return (
    <Autocomplete
      size="small"
      options={zones}
      value={value}
      disableClearable
      onChange={(_, v) => {
        onChange(v);
      }}
      groupBy={(z) =>
        z === LOCAL_TIME_ZONE
          ? 'Your time zone'
          : z === 'UTC'
            ? 'Universal'
            : (z.split('/')[0] ?? 'Other')
      }
      sx={{ width }}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}
