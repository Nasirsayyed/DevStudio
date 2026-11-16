import { Box, Checkbox, IconButton, Stack, TextField, Tooltip } from '@mui/material';
import { Eye, EyeSlash, Lock1, Trash, Unlock } from 'iconsax-reactjs';
import { useState } from 'react';
import { rowId } from '@/core/http/model';
import { fontFamilies } from '@/theme/tokens';

export interface KvRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  secret?: boolean;
}

/**
 * Editable key/value rows. An empty row is always shown at the end, so typing in it adds a new
 * row. With `secrets`, each row can be marked secret (value masked, kept per the secrets policy).
 */
export function KeyValueEditor<T extends KvRow>({
  label,
  rows,
  onChange,
  keyLabel = 'Key',
  valueLabel = 'Value',
  secrets = false,
  make,
}: {
  label: string;
  rows: readonly T[];
  onChange: (rows: T[]) => void;
  keyLabel?: string;
  valueLabel?: string;
  secrets?: boolean;
  /** Creates a new row (defaults to a plain key/value). */
  make?: () => T;
}) {
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const blank = (make ?? (() => ({ id: rowId(), key: '', value: '', enabled: true }) as T))();
  const [pending, setPending] = useState<T>(blank);
  const all = [...rows, pending];
  const change = (row: T, patch: Partial<KvRow>) => {
    const next = { ...row, ...patch };
    if (row.id === pending.id) {
      onChange([...rows, next]);
      setPending((make ?? (() => ({ id: rowId(), key: '', value: '', enabled: true }) as T))());
    } else onChange(rows.map((r) => (r.id === row.id ? next : r)));
  };
  return (
    <Box role="group" aria-label={label}>
      {all.map((row, i) => {
        const isPending = row.id === pending.id;
        const n = i + 1;
        const hidden = secrets && row.secret === true && !revealed.has(row.id);
        return (
          <Stack key={row.id} direction="row" spacing={0.5} sx={{ alignItems: 'center', py: 0.25 }}>
            <Checkbox
              size="small"
              checked={row.enabled}
              disabled={isPending}
              onChange={(e) => {
                change(row, { enabled: e.target.checked });
              }}
              slotProps={{ input: { 'aria-label': `Enable ${label} row ${String(n)}` } }}
            />
            <TextField
              size="small"
              placeholder={keyLabel}
              value={row.key}
              onChange={(e) => {
                change(row, { key: e.target.value });
              }}
              sx={{ flex: 1, minWidth: 0 }}
              slotProps={{
                htmlInput: {
                  'aria-label': `${label} ${keyLabel.toLowerCase()} ${String(n)}`,
                  spellCheck: false,
                  style: { fontFamily: fontFamilies.mono, fontSize: 13 },
                },
              }}
            />
            <TextField
              size="small"
              placeholder={valueLabel}
              type={hidden ? 'password' : 'text'}
              value={row.value}
              onChange={(e) => {
                change(row, { value: e.target.value });
              }}
              sx={{ flex: 1.4, minWidth: 0 }}
              autoComplete="off"
              slotProps={{
                htmlInput: {
                  'aria-label': `${label} ${valueLabel.toLowerCase()} ${String(n)}`,
                  spellCheck: false,
                  autoComplete: 'off',
                  style: { fontFamily: fontFamilies.mono, fontSize: 13 },
                },
              }}
            />
            {secrets && (
              <>
                <Tooltip
                  title={row.secret ? 'Secret (click to make it a normal value)' : 'Mark as secret'}
                >
                  <IconButton
                    size="small"
                    aria-pressed={row.secret === true}
                    aria-label={`Secret ${label} row ${String(n)}`}
                    onClick={() => {
                      change(row, { secret: !row.secret });
                    }}
                  >
                    {row.secret ? (
                      <Lock1 size={16} color="currentColor" />
                    ) : (
                      <Unlock size={16} color="currentColor" />
                    )}
                  </IconButton>
                </Tooltip>
                <IconButton
                  size="small"
                  disabled={!row.secret}
                  aria-label={
                    revealed.has(row.id) ? `Hide value ${String(n)}` : `Show value ${String(n)}`
                  }
                  onClick={() => {
                    const next = new Set(revealed);
                    if (next.has(row.id)) next.delete(row.id);
                    else next.add(row.id);
                    setRevealed(next);
                  }}
                >
                  {revealed.has(row.id) ? (
                    <EyeSlash size={16} color="currentColor" />
                  ) : (
                    <Eye size={16} color="currentColor" />
                  )}
                </IconButton>
              </>
            )}
            <IconButton
              size="small"
              disabled={isPending}
              aria-label={`Remove ${label} row ${String(n)}`}
              onClick={() => {
                onChange(rows.filter((r) => r.id !== row.id));
              }}
            >
              <Trash size={16} color="currentColor" />
            </IconButton>
          </Stack>
        );
      })}
    </Box>
  );
}
