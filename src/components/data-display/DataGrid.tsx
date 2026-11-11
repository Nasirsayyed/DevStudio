import { Box, ButtonBase, Typography } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown2, ArrowUp2 } from 'iconsax-reactjs';
import { type ReactNode, useMemo, useRef, useState } from 'react';

export interface DataGridColumn<T> {
  id: string;
  header: string;
  /** Fixed width in px; columns without a width share the remaining space. */
  width?: number;
  /** Value used for sorting and as default cell text. */
  getValue: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  mono?: boolean;
}

export interface DataGridProps<T> {
  rows: readonly T[];
  columns: readonly DataGridColumn<T>[];
  rowKey: (row: T, index: number) => string;
  ariaLabel: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  rowHeight?: number;
  height?: number | string;
}

/** Virtualized, sortable data grid (WAI-ARIA grid roles). */
export function DataGrid<T>({
  rows,
  columns,
  rowKey,
  ariaLabel,
  onRowClick,
  emptyMessage = 'No rows',
  rowHeight = 34,
  height = '100%',
}: DataGridProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<{ id: string; dir: 'asc' | 'desc' } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.getValue(a);
      const vb = col.getValue(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (
        (typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { numeric: true })) * factor
      );
    });
  }, [rows, columns, sort]);

  // TanStack Virtual returns non-memoizable functions, so the React Compiler skips this component (expected).
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    initialRect: { width: 800, height: 400 },
  });

  const template = columns.map((c) => (c.width ? `${c.width}px` : 'minmax(120px, 1fr)')).join(' ');

  return (
    <Box
      ref={scrollRef}
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={sorted.length + 1}
      sx={{
        height,
        overflow: 'auto',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        minHeight: 0,
      }}
    >
      <Box
        role="row"
        aria-rowindex={1}
        sx={{
          display: 'grid',
          gridTemplateColumns: template,
          position: 'sticky',
          top: 0,
          zIndex: 1,
          bgcolor: 'background.sunken',
          borderBottom: 1,
          borderColor: 'divider',
          minWidth: 'max-content',
        }}
      >
        {columns.map((c) => {
          const active = sort?.id === c.id;
          const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
          return (
            <Box
              role="columnheader"
              key={c.id}
              aria-sort={c.sortable === false ? undefined : ariaSort}
              sx={{ px: 1.5, py: 0.75 }}
            >
              {c.sortable === false ? (
                <Typography variant="caption" sx={{ fontWeight: 650 }}>
                  {c.header}
                </Typography>
              ) : (
                <ButtonBase
                  onClick={() => {
                    setSort(
                      active
                        ? sort.dir === 'asc'
                          ? { id: c.id, dir: 'desc' }
                          : null
                        : { id: c.id, dir: 'asc' },
                    );
                  }}
                  sx={{ gap: 0.5, typography: 'caption', fontWeight: 650 }}
                >
                  {c.header}
                  {active &&
                    (sort.dir === 'asc' ? (
                      <ArrowUp2 size={12} color="currentColor" />
                    ) : (
                      <ArrowDown2 size={12} color="currentColor" />
                    ))}
                </ButtonBase>
              )}
            </Box>
          );
        })}
      </Box>
      {sorted.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
          {emptyMessage}
        </Typography>
      ) : (
        <Box
          sx={{ height: virtualizer.getTotalSize(), position: 'relative', minWidth: 'max-content' }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = sorted[item.index] as T;
            return (
              <Box
                role="row"
                aria-rowindex={item.index + 2}
                key={rowKey(row, item.index)}
                onClick={
                  onRowClick
                    ? () => {
                        onRowClick(row);
                      }
                    : undefined
                }
                sx={{
                  display: 'grid',
                  gridTemplateColumns: template,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: rowHeight,
                  transform: `translateY(${item.start}px)`,
                  borderBottom: 1,
                  borderColor: 'divider',
                  cursor: onRowClick ? 'pointer' : 'default',
                  '&:hover': onRowClick ? { bgcolor: 'action.hover' } : undefined,
                }}
              >
                {columns.map((c) => (
                  <Box
                    role="gridcell"
                    key={c.id}
                    sx={{
                      px: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden',
                      fontSize: 12.5,
                      fontFamily: c.mono ? 'monospace' : undefined,
                    }}
                  >
                    <Box
                      component="span"
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {c.render ? c.render(row) : String(c.getValue(row) ?? '')}
                    </Box>
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
