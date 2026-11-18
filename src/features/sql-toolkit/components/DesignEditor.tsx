import {
  Box,
  Button,
  Checkbox,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, Trash } from 'iconsax-reactjs';
import { useState } from 'react';
import {
  type DesignColumn,
  type DesignTable,
  newColumn,
  newId,
  newTable,
  ON_DELETE,
  PORTABLE_TYPES,
  type PortableType,
  type SchemaDesign,
} from '@/core/sql/design';

const WITH_LENGTH = new Set<PortableType>(['VARCHAR', 'CHAR', 'DECIMAL']);

function uniqueName(base: string, taken: readonly string[]): string {
  let name = base;
  for (let n = 2; taken.some((t) => t.toLowerCase() === name.toLowerCase()); n += 1)
    name = `${base}_${String(n)}`;
  return name;
}

/** Editing surface of the Schema Designer: tables, columns and relationships. */
export function DesignEditor({
  design,
  onChange,
  selectedId,
  onSelect,
}: {
  design: SchemaDesign;
  onChange: (d: SchemaDesign) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const table = design.tables.find((t) => t.id === selectedId) ?? design.tables[0] ?? null;
  const [relation, setRelation] = useState<{
    column: string;
    table: string;
    target: string;
    onDelete: (typeof ON_DELETE)[number];
  }>({
    column: '',
    table: '',
    target: '',
    onDelete: 'NO ACTION',
  });

  const updateTable = (id: string, patch: Partial<DesignTable>) => {
    onChange({
      ...design,
      tables: design.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  };
  const updateColumn = (t: DesignTable, colId: string, patch: Partial<DesignColumn>) => {
    updateTable(t.id, {
      columns: t.columns.map((c) => {
        if (c.id !== colId) return c;
        const next = { ...c, ...patch };
        if (patch.type) {
          next.length =
            patch.type === 'VARCHAR'
              ? (c.length ?? 255)
              : patch.type === 'CHAR'
                ? (c.length ?? 1)
                : patch.type === 'DECIMAL'
                  ? (c.length ?? 18)
                  : null;
          next.scale = patch.type === 'DECIMAL' ? (c.scale ?? 2) : null;
          if (!['INTEGER', 'BIGINT', 'SMALLINT'].includes(patch.type)) next.identity = false;
        }
        if (patch.primaryKey) next.nullable = false;
        return next;
      }),
    });
  };
  const addTable = () => {
    const t = newTable(
      uniqueName(
        'table',
        design.tables.map((x) => x.name),
      ),
    );
    onChange({ ...design, tables: [...design.tables, t] });
    onSelect(t.id);
  };
  const removeTable = (id: string) => {
    onChange({
      ...design,
      tables: design.tables.filter((t) => t.id !== id),
      relations: design.relations.filter((r) => r.fromTable !== id && r.toTable !== id),
    });
    onSelect(null);
  };
  const removeColumn = (t: DesignTable, colId: string) => {
    onChange({
      ...design,
      tables: design.tables.map((x) =>
        x.id === t.id ? { ...x, columns: x.columns.filter((c) => c.id !== colId) } : x,
      ),
      relations: design.relations.filter((r) => r.fromColumn !== colId && r.toColumn !== colId),
    });
  };

  const targetTable = design.tables.find((t) => t.id === relation.table);
  const name = (tableId: string, colId: string) => {
    const t = design.tables.find((x) => x.id === tableId);
    return `${t?.name ?? '?'}.${t?.columns.find((c) => c.id === colId)?.name ?? '?'}`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2, pt: 2 }}>
        <TextField
          select
          size="small"
          label="Table"
          value={table?.id ?? ''}
          disabled={design.tables.length === 0}
          onChange={(e) => {
            onSelect(e.target.value);
          }}
          sx={{ flex: 1, minWidth: 0 }}
        >
          {design.tables.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name || '(unnamed)'} · {t.columns.length} columns
            </MenuItem>
          ))}
        </TextField>
        <Button
          startIcon={<Add size={16} color="currentColor" />}
          onClick={addTable}
          sx={{ flexShrink: 0 }}
        >
          Add table
        </Button>
      </Stack>
      {!table ? (
        <Stack spacing={1} sx={{ p: 3, alignItems: 'flex-start' }}>
          <Typography variant="body2" color="text.secondary">
            Start with a table, import CREATE TABLE statements, or load the sample.
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={2} sx={{ p: 2, flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small"
              label="Table name"
              value={table.name}
              onChange={(e) => {
                updateTable(table.id, { name: e.target.value });
              }}
              sx={{ flex: 1 }}
              slotProps={{ htmlInput: { maxLength: 128 } }}
            />
            <Tooltip title="Delete table">
              <IconButton
                aria-label={`Delete table ${table.name}`}
                onClick={() => {
                  removeTable(table.id);
                }}
              >
                <Trash size={18} color="currentColor" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box sx={{ overflowX: 'auto' }}>
            <Table
              size="small"
              aria-label={`Columns of ${table.name}`}
              sx={{ '& td, & th': { px: 0.5 } }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell title="Primary key">PK</TableCell>
                  <TableCell title="Not null">NN</TableCell>
                  <TableCell title="Unique">UQ</TableCell>
                  <TableCell title="Auto-increment">AI</TableCell>
                  <TableCell>Default</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {table.columns.map((c, i) => {
                  const label = c.name || `column ${String(i + 1)}`;
                  return (
                    <TableRow key={c.id}>
                      <TableCell sx={{ minWidth: 100 }}>
                        <TextField
                          variant="standard"
                          size="small"
                          fullWidth
                          value={c.name}
                          onChange={(e) => {
                            updateColumn(table, c.id, { name: e.target.value });
                          }}
                          slotProps={{
                            htmlInput: {
                              'aria-label': `Name of column ${String(i + 1)}`,
                              maxLength: 128,
                            },
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 110 }}>
                        <TextField
                          select
                          variant="standard"
                          size="small"
                          fullWidth
                          value={c.type}
                          onChange={(e) => {
                            const t = PORTABLE_TYPES.find((x) => x === e.target.value);
                            if (t) updateColumn(table, c.id, { type: t });
                          }}
                          slotProps={{ htmlInput: { 'aria-label': `Type of ${label}` } }}
                        >
                          {PORTABLE_TYPES.map((t) => (
                            <MenuItem key={t} value={t}>
                              {t}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell sx={{ minWidth: 70 }}>
                        {WITH_LENGTH.has(c.type) && (
                          <Stack direction="row" spacing={0.5}>
                            <TextField
                              variant="standard"
                              size="small"
                              value={c.length ?? ''}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                updateColumn(table, c.id, {
                                  length:
                                    e.target.value === ''
                                      ? null
                                      : Number.isInteger(n) && n > 0
                                        ? Math.min(n, 1_000_000)
                                        : c.length,
                                });
                              }}
                              slotProps={{
                                htmlInput: {
                                  'aria-label': `Length of ${label}`,
                                  inputMode: 'numeric',
                                },
                              }}
                              sx={{ width: 48 }}
                            />
                            {c.type === 'DECIMAL' && (
                              <TextField
                                variant="standard"
                                size="small"
                                value={c.scale ?? ''}
                                onChange={(e) => {
                                  const n = Number(e.target.value);
                                  updateColumn(table, c.id, {
                                    scale:
                                      e.target.value === ''
                                        ? null
                                        : Number.isInteger(n) && n >= 0
                                          ? Math.min(n, 38)
                                          : c.scale,
                                  });
                                }}
                                slotProps={{
                                  htmlInput: {
                                    'aria-label': `Scale of ${label}`,
                                    inputMode: 'numeric',
                                  },
                                }}
                                sx={{ width: 36 }}
                              />
                            )}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell sx={{ width: 34, p: 0 }}>
                        <Checkbox
                          size="small"
                          sx={{ p: 0.5 }}
                          checked={c.primaryKey}
                          onChange={(e) => {
                            updateColumn(table, c.id, { primaryKey: e.target.checked });
                          }}
                          slotProps={{ input: { 'aria-label': `${label} is the primary key` } }}
                        />
                      </TableCell>
                      <TableCell sx={{ width: 34, p: 0 }}>
                        <Checkbox
                          size="small"
                          sx={{ p: 0.5 }}
                          checked={!c.nullable}
                          disabled={c.primaryKey}
                          onChange={(e) => {
                            updateColumn(table, c.id, { nullable: !e.target.checked });
                          }}
                          slotProps={{ input: { 'aria-label': `${label} is required` } }}
                        />
                      </TableCell>
                      <TableCell sx={{ width: 34, p: 0 }}>
                        <Checkbox
                          size="small"
                          sx={{ p: 0.5 }}
                          checked={c.unique}
                          onChange={(e) => {
                            updateColumn(table, c.id, { unique: e.target.checked });
                          }}
                          slotProps={{ input: { 'aria-label': `${label} is unique` } }}
                        />
                      </TableCell>
                      <TableCell sx={{ width: 34, p: 0 }}>
                        <Checkbox
                          size="small"
                          sx={{ p: 0.5 }}
                          checked={c.identity}
                          disabled={!['INTEGER', 'BIGINT', 'SMALLINT'].includes(c.type)}
                          onChange={(e) => {
                            updateColumn(table, c.id, { identity: e.target.checked });
                          }}
                          slotProps={{ input: { 'aria-label': `${label} auto-increments` } }}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 80 }}>
                        <TextField
                          variant="standard"
                          size="small"
                          fullWidth
                          value={c.defaultValue}
                          onChange={(e) => {
                            updateColumn(table, c.id, { defaultValue: e.target.value });
                          }}
                          slotProps={{
                            htmlInput: { 'aria-label': `Default of ${label}`, maxLength: 500 },
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ width: 34, p: 0 }}>
                        <IconButton
                          size="small"
                          aria-label={`Delete ${label}`}
                          onClick={() => {
                            removeColumn(table, c.id);
                          }}
                        >
                          <Trash size={16} color="currentColor" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
          <Button
            size="small"
            startIcon={<Add size={16} color="currentColor" />}
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => {
              updateTable(table.id, {
                columns: [
                  ...table.columns,
                  newColumn({
                    name: uniqueName(
                      'column',
                      table.columns.map((c) => c.name),
                    ),
                  }),
                ],
              });
            }}
          >
            Add column
          </Button>

          <Box role="group" aria-label="Relationships">
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
              Relationships (foreign keys)
            </Typography>
            {design.relations
              .filter((r) => r.fromTable === table.id)
              .map((r) => (
                <Stack
                  key={r.id}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', mb: 0.5 }}
                >
                  <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                    {name(r.fromTable, r.fromColumn)} → {name(r.toTable, r.toColumn)}
                    {r.onDelete !== 'NO ACTION' ? ` (ON DELETE ${r.onDelete})` : ''}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label={`Delete relationship ${name(r.fromTable, r.fromColumn)}`}
                    onClick={() => {
                      onChange({
                        ...design,
                        relations: design.relations.filter((x) => x.id !== r.id),
                      });
                    }}
                  >
                    <Trash size={16} color="currentColor" />
                  </IconButton>
                </Stack>
              ))}
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: 'wrap', alignItems: 'center', mt: 1 }}
            >
              <TextField
                select
                size="small"
                label="Column"
                value={relation.column}
                onChange={(e) => {
                  setRelation({ ...relation, column: e.target.value });
                }}
                sx={{ width: 140 }}
              >
                {table.columns.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="References table"
                value={relation.table}
                onChange={(e) => {
                  const target = design.tables.find((t) => t.id === e.target.value);
                  setRelation({
                    ...relation,
                    table: e.target.value,
                    target:
                      target?.columns.find((c) => c.primaryKey)?.id ?? target?.columns[0]?.id ?? '',
                  });
                }}
                sx={{ width: 170 }}
              >
                {design.tables.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Column there"
                value={relation.target}
                onChange={(e) => {
                  setRelation({ ...relation, target: e.target.value });
                }}
                sx={{ width: 140 }}
                disabled={!targetTable}
              >
                {(targetTable?.columns ?? []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="On delete"
                value={relation.onDelete}
                onChange={(e) => {
                  const a = ON_DELETE.find((x) => x === e.target.value);
                  if (a) setRelation({ ...relation, onDelete: a });
                }}
                sx={{ width: 140 }}
              >
                {ON_DELETE.map((a) => (
                  <MenuItem key={a} value={a}>
                    {a}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                size="small"
                disabled={!relation.column || !relation.table || !relation.target}
                onClick={() => {
                  onChange({
                    ...design,
                    relations: [
                      ...design.relations,
                      {
                        id: newId(),
                        fromTable: table.id,
                        fromColumn: relation.column,
                        toTable: relation.table,
                        toColumn: relation.target,
                        onDelete: relation.onDelete,
                      },
                    ],
                  });
                  setRelation({ column: '', table: '', target: '', onDelete: 'NO ACTION' });
                }}
              >
                Add relationship
              </Button>
            </Stack>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
