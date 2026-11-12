import {
  Alert,
  Autocomplete,
  Box,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, Trash } from 'iconsax-reactjs';
import { useState } from 'react';
import { CodeEditor, CopyButton } from '@/components';
import { DownloadButton } from '@/components/inputs/DownloadButton';
import { SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { toUserMessage } from '@/core/errors/AppError';
import {
  type Condition,
  generateDelete,
  generateInsert,
  generateSelect,
  generateUpdate,
  type GeneratedSql,
  primaryKeyConditions,
  type ValueMode,
} from '@/core/sql/generators';
import type { SqlDialect } from '@/core/sql/dialects';
import type { TableModel } from '@/core/sql/schema';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { SAMPLE_ROWS } from '../samples';
import { ConditionsEditor } from './ConditionsEditor';

export type StatementKind = 'select' | 'insert' | 'update' | 'delete';

export interface BuilderSettings {
  valueMode: ValueMode;
  quoteAll: boolean;
  rowsPerStatement: number;
}

function ColumnsField({
  label,
  table,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  table: TableModel;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  return (
    <Autocomplete
      multiple
      size="small"
      options={table.columns.map((c) => c.name)}
      value={value}
      onChange={(_, v) => {
        onChange(v);
      }}
      renderValue={(vals, getItemProps) =>
        vals.map((option, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          return <Chip key={key} size="small" label={option} {...itemProps} />;
        })
      }
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={value.length ? '' : placeholder} />
      )}
    />
  );
}

/** Builder for one statement kind on one table; output is generated on every change. */
export function StatementBuilder({
  kind,
  table,
  tables,
  dialect,
  settings,
}: {
  kind: StatementKind;
  table: TableModel;
  tables: readonly TableModel[];
  dialect: SqlDialect;
  settings: BuilderSettings;
}) {
  const data = useSqlWorkspaceStore((s) => s.data);
  const set = useSqlWorkspaceStore((s) => s.set);
  const record = useHistoryRecorder('sql.query-generator');
  const pkWhere = primaryKeyConditions(table);
  const [columns, setColumns] = useState<string[]>([]);
  const [where, setWhere] = useState<Condition[]>(
    kind === 'update' || kind === 'delete' ? pkWhere : [],
  );
  const [join, setJoin] = useState<'AND' | 'OR'>('AND');
  const [distinct, setDistinct] = useState(false);
  const [count, setCount] = useState(false);
  const [orderBy, setOrderBy] = useState<{ column: string; direction: 'ASC' | 'DESC' }[]>([]);
  const [limit, setLimit] = useState('');
  const [offset, setOffset] = useState('');
  const [joins, setJoins] = useState<Record<number, 'INNER' | 'LEFT' | null>>({});
  const [skipIdentity, setSkipIdentity] = useState(true);
  const [source, setSource] = useState<'template' | 'json' | 'csv'>('template');
  const [onConflict, setOnConflict] = useState<'none' | 'ignore' | 'update'>('none');
  const [setValues, setSetValues] = useState<Record<string, string>>({});
  const [allowAllRows, setAllowAllRows] = useState(false);
  const [previewCount, setPreviewCount] = useState(true);
  const [transaction, setTransaction] = useState(false);
  const [softDelete, setSoftDelete] = useState('');

  const common = { table, dialect, valueMode: settings.valueMode, quoteAll: settings.quoteAll };
  const toInt = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : null);
  let result: GeneratedSql | null = null;
  let error: string | null = null;
  try {
    if (kind === 'select')
      result = generateSelect({
        ...common,
        columns,
        distinct,
        count,
        where,
        whereJoin: join,
        orderBy,
        limit: toInt(limit),
        offset: toInt(offset),
        joins: table.foreignKeys.flatMap((fk, i) => {
          const type = joins[i];
          if (!type) return [];
          const target = tables.find((t) => t.name === fk.refTable);
          return [{ foreignKey: fk, type, ...(target ? { table: target } : {}) }];
        }),
      });
    else if (kind === 'insert')
      result = generateInsert({
        ...common,
        columns,
        skipIdentity,
        data: source === 'template' ? null : { format: source, text: data },
        rowsPerStatement: settings.rowsPerStatement,
        onConflict,
      });
    else if (kind === 'update')
      result = generateUpdate({
        ...common,
        set: columns.map((column) => ({ column, value: setValues[column] ?? '' })),
        where,
        whereJoin: join,
        allowAllRows,
      });
    else
      result = generateDelete({
        ...common,
        where,
        whereJoin: join,
        allowAllRows,
        previewCount,
        transaction,
        softDeleteColumn: softDelete || null,
      });
  } catch (e) {
    error = toUserMessage(e);
  }

  const conditions = (
    <ConditionsEditor
      columns={table.columns}
      conditions={where}
      join={join}
      valueMode={settings.valueMode}
      onChange={setWhere}
      onJoinChange={setJoin}
    />
  );
  const exported = () => {
    if (result)
      record(`${kind.toUpperCase()} for ${table.name}`, '', result.sql, { dialect, ...settings });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Stack spacing={2} sx={{ p: 2, overflowY: 'auto', flex: '1 1 50%', minHeight: 0 }}>
        {kind === 'select' && (
          <>
            <ColumnsField
              label="Columns"
              table={table}
              value={columns}
              onChange={setColumns}
              placeholder="All columns"
            />
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <SwitchOption label="DISTINCT" checked={distinct} onChange={setDistinct} />
              <SwitchOption label="Count rows only" checked={count} onChange={setCount} />
            </Stack>
            {table.foreignKeys.length > 0 && (
              <Stack spacing={1} role="group" aria-label="Joins">
                <Typography variant="subtitle2" component="h3">
                  Joins
                </Typography>
                {table.foreignKeys.map((fk, i) => (
                  <Stack
                    key={`${fk.refTable}-${fk.columns.join()}`}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center' }}
                  >
                    <FormControlLabel
                      sx={{ flex: 1 }}
                      control={
                        <Checkbox
                          size="small"
                          checked={Boolean(joins[i])}
                          onChange={(e) => {
                            setJoins({ ...joins, [i]: e.target.checked ? 'INNER' : null });
                          }}
                        />
                      }
                      label={`${fk.refTable} (${fk.columns.join(', ')} → ${fk.refColumns.join(', ') || 'id'})`}
                    />
                    {joins[i] && (
                      <SelectOption
                        label="Join"
                        value={joins[i]}
                        options={[
                          { value: 'INNER', label: 'INNER' },
                          { value: 'LEFT', label: 'LEFT' },
                        ]}
                        width={110}
                        onChange={(v) => {
                          setJoins({ ...joins, [i]: v });
                        }}
                      />
                    )}
                  </Stack>
                ))}
              </Stack>
            )}
            {conditions}
            {!count && (
              <Stack spacing={1} role="group" aria-label="ORDER BY">
                <Typography variant="subtitle2" component="h3">
                  ORDER BY
                </Typography>
                {orderBy.map((o, i) => (
                  <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <TextField
                      select
                      size="small"
                      label="Column"
                      value={o.column}
                      sx={{ flex: 1 }}
                      onChange={(e) => {
                        setOrderBy(
                          orderBy.map((x, n) => (n === i ? { ...x, column: e.target.value } : x)),
                        );
                      }}
                    >
                      {table.columns.map((c) => (
                        <MenuItem key={c.name} value={c.name}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <SelectOption
                      label="Direction"
                      value={o.direction}
                      options={[
                        { value: 'ASC', label: 'ASC' },
                        { value: 'DESC', label: 'DESC' },
                      ]}
                      width={110}
                      onChange={(direction) => {
                        setOrderBy(orderBy.map((x, n) => (n === i ? { ...x, direction } : x)));
                      }}
                    />
                    <IconButton
                      size="small"
                      aria-label={`Remove sort ${String(i + 1)}`}
                      onClick={() => {
                        setOrderBy(orderBy.filter((_, n) => n !== i));
                      }}
                    >
                      <Trash size={16} color="currentColor" />
                    </IconButton>
                  </Stack>
                ))}
                <Box>
                  <Tooltip title="Add sort column">
                    <IconButton
                      size="small"
                      aria-label="Add sort column"
                      onClick={() => {
                        setOrderBy([
                          ...orderBy,
                          { column: table.columns[0]?.name ?? '', direction: 'ASC' },
                        ]);
                      }}
                    >
                      <Add size={16} color="currentColor" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    label="Limit"
                    value={limit}
                    onChange={(e) => {
                      setLimit(e.target.value);
                    }}
                    sx={{ width: 110 }}
                    slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                  />
                  <TextField
                    size="small"
                    label="Offset"
                    value={offset}
                    onChange={(e) => {
                      setOffset(e.target.value);
                    }}
                    sx={{ width: 110 }}
                    slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                  />
                </Stack>
              </Stack>
            )}
          </>
        )}
        {kind === 'insert' && (
          <>
            <ColumnsField
              label="Columns"
              table={table}
              value={columns}
              onChange={setColumns}
              placeholder={skipIdentity ? 'All columns except identity' : 'All columns'}
            />
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{ flexWrap: 'wrap', alignItems: 'center' }}
            >
              <SwitchOption
                label="Skip identity columns"
                checked={skipIdentity}
                onChange={setSkipIdentity}
              />
              <SelectOption
                label="Row values"
                value={source}
                options={[
                  { value: 'template', label: 'One template row' },
                  { value: 'json', label: 'From JSON data' },
                  { value: 'csv', label: 'From CSV data' },
                ]}
                width={180}
                onChange={setSource}
              />
              <SelectOption
                label="On conflict"
                value={onConflict}
                options={[
                  { value: 'none', label: 'Plain INSERT' },
                  { value: 'ignore', label: 'Skip existing rows' },
                  { value: 'update', label: 'Update existing rows' },
                ]}
                width={190}
                onChange={setOnConflict}
              />
            </Stack>
            {source !== 'template' && (
              <Box
                sx={{
                  height: 180,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <CodeEditor
                  value={data}
                  onChange={(v) => {
                    set({ data: v });
                  }}
                  language={source === 'json' ? 'json' : 'plaintext'}
                  ariaLabel={source === 'json' ? 'JSON data' : 'CSV data'}
                />
              </Box>
            )}
            {source === 'json' && !data.trim() && (
              <Box>
                <Chip
                  size="small"
                  label="Load sample rows"
                  onClick={() => {
                    set({ data: SAMPLE_ROWS });
                  }}
                />
              </Box>
            )}
          </>
        )}
        {kind === 'update' && (
          <>
            <ColumnsField
              label="SET columns"
              table={table}
              value={columns}
              onChange={setColumns}
              placeholder="Choose columns to update"
            />
            {settings.valueMode === 'literals' &&
              columns.map((c) => (
                <TextField
                  key={c}
                  size="small"
                  label={`New value for ${c}`}
                  value={setValues[c] ?? ''}
                  onChange={(e) => {
                    setSetValues({ ...setValues, [c]: e.target.value });
                  }}
                />
              ))}
            {conditions}
            <SwitchOption
              label="Allow updating every row"
              checked={allowAllRows}
              onChange={setAllowAllRows}
            />
          </>
        )}
        {kind === 'delete' && (
          <>
            {conditions}
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{ flexWrap: 'wrap', alignItems: 'center' }}
            >
              <SwitchOption
                label="Count affected rows first"
                checked={previewCount}
                onChange={setPreviewCount}
              />
              <SwitchOption
                label="Wrap in a transaction"
                checked={transaction}
                onChange={setTransaction}
              />
              <SwitchOption
                label="Allow deleting every row"
                checked={allowAllRows}
                onChange={setAllowAllRows}
              />
              <TextField
                select
                size="small"
                label="Soft delete"
                value={softDelete}
                onChange={(e) => {
                  setSoftDelete(e.target.value);
                }}
                sx={{ width: 200 }}
              >
                <MenuItem value="">No (real DELETE)</MenuItem>
                {table.columns.map((c) => (
                  <MenuItem key={c.name} value={c.name}>
                    Set {c.name} = now
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </>
        )}
      </Stack>
      <Box
        sx={{
          flex: '1 1 50%',
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1.5, py: 0.5 }}>
          <Typography variant="subtitle2" component="h3" sx={{ flex: 1 }}>
            Generated SQL
          </Typography>
          {result && result.parameters.length > 0 && (
            <Typography variant="caption" color="text.secondary" aria-label="Parameters">
              Parameters: {result.parameters.map((p) => p.name).join(', ')}
            </Typography>
          )}
          {result && <CopyButton label="Copy SQL" value={result.sql} onCopied={exported} />}
          {result && (
            <DownloadButton
              content={result.sql}
              filename={`${kind}-${table.name}.sql`}
              mimeType="application/sql"
              label="Download SQL"
              onDownloaded={exported}
            />
          )}
        </Stack>
        {error ? (
          <Alert severity="warning" role="alert" sx={{ m: 1.5 }}>
            {error}
          </Alert>
        ) : (
          result && (
            <>
              {result.notes.map((n) => (
                <Alert key={n} severity="info" sx={{ mx: 1.5, mb: 1, py: 0 }}>
                  {n}
                </Alert>
              ))}
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <CodeEditor
                  value={result.sql}
                  readOnly
                  language="sql"
                  ariaLabel="Generated SQL"
                  wordWrap
                />
              </Box>
            </>
          )
        )}
      </Box>
    </Box>
  );
}
