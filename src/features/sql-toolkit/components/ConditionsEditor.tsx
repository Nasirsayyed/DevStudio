import {
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, Trash } from 'iconsax-reactjs';
import { type Condition, OPERATORS, type ValueMode } from '@/core/sql/generators';
import type { ColumnModel } from '@/core/sql/schema';

const needsValue = (op: Condition['operator']) => op !== 'IS NULL' && op !== 'IS NOT NULL';

/** WHERE conditions: column, operator and (for literal values) the value. */
export function ConditionsEditor({
  columns,
  conditions,
  join,
  valueMode,
  onChange,
  onJoinChange,
}: {
  columns: readonly ColumnModel[];
  conditions: readonly Condition[];
  join: 'AND' | 'OR';
  valueMode: ValueMode;
  onChange: (conditions: Condition[]) => void;
  onJoinChange: (join: 'AND' | 'OR') => void;
}) {
  const update = (i: number, patch: Partial<Condition>) => {
    onChange(conditions.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  };
  return (
    <Stack spacing={1} role="group" aria-label="WHERE conditions">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle2" component="h3" sx={{ flex: 1 }}>
          WHERE
        </Typography>
        {conditions.length > 1 && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={join}
            aria-label="Combine conditions with"
            onChange={(_, v: 'AND' | 'OR' | null) => {
              if (v) onJoinChange(v);
            }}
          >
            <ToggleButton value="AND">AND</ToggleButton>
            <ToggleButton value="OR">OR</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>
      {conditions.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No conditions.
        </Typography>
      )}
      {conditions.map((c, i) => (
        <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            select
            size="small"
            label="Column"
            value={c.column}
            onChange={(e) => {
              update(i, { column: e.target.value });
            }}
            sx={{ minWidth: 140, flex: 1 }}
          >
            {columns.map((col) => (
              <MenuItem key={col.name} value={col.name}>
                {col.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Operator"
            value={c.operator}
            onChange={(e) => {
              const op = OPERATORS.find((o) => o === e.target.value);
              if (op) update(i, { operator: op });
            }}
            sx={{ width: 140 }}
          >
            {OPERATORS.map((o) => (
              <MenuItem key={o} value={o}>
                {o}
              </MenuItem>
            ))}
          </TextField>
          {valueMode === 'literals' && needsValue(c.operator) && (
            <TextField
              size="small"
              label={
                c.operator === 'IN'
                  ? 'Values (a, b, c)'
                  : c.operator === 'BETWEEN'
                    ? 'From, to'
                    : 'Value'
              }
              value={c.value}
              onChange={(e) => {
                update(i, { value: e.target.value });
              }}
              sx={{ flex: 1, minWidth: 120 }}
            />
          )}
          <Tooltip title="Remove condition">
            <IconButton
              size="small"
              aria-label={`Remove condition ${String(i + 1)}`}
              onClick={() => {
                onChange(conditions.filter((_, n) => n !== i));
              }}
            >
              <Trash size={16} color="currentColor" />
            </IconButton>
          </Tooltip>
        </Stack>
      ))}
      <Button
        size="small"
        startIcon={<Add size={16} color="currentColor" />}
        disabled={columns.length === 0}
        onClick={() => {
          onChange([...conditions, { column: columns[0]?.name ?? '', operator: '=', value: '' }]);
        }}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add condition
      </Button>
    </Stack>
  );
}
