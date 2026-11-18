import { alpha, Box, Button, useTheme } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';
import { type DiffItem, type DiffLine, type DiffRow, foldUnchanged } from '@/core/text/diff';
import { fontFamilies } from '@/theme/tokens';

type Tone = 'add' | 'del' | 'none';

function LineText({ line, tone }: { line: DiffLine | undefined; tone: Tone }) {
  const theme = useTheme();
  if (!line) return null;
  const strong =
    tone === 'add'
      ? alpha(theme.palette.success.main, 0.35)
      : alpha(theme.palette.error.main, 0.35);
  if (!line.segments) return <>{line.text || ' '}</>;
  return (
    <>
      {line.segments.map((s, i) =>
        s.changed ? (
          <Box
            key={i}
            component="mark"
            sx={{ bgcolor: strong, color: 'inherit', borderRadius: 0.5 }}
          >
            {s.text}
          </Box>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
      {line.text === '' ? ' ' : null}
    </>
  );
}

interface VisualRow {
  key: string;
  item: DiffItem;
  /** Inline view splits a change into its deleted and inserted line. */
  part?: 'del' | 'add';
}

function toVisual(items: DiffItem[], inline: boolean): VisualRow[] {
  const out: VisualRow[] = [];
  for (const item of items) {
    if (item.kind === 'fold') {
      out.push({ key: `f${String(item.start)}`, item });
      continue;
    }
    const k = String(item.index);
    if (inline && item.row.kind === 'change') {
      out.push({ key: `${k}d`, item, part: 'del' }, { key: `${k}a`, item, part: 'add' });
    } else out.push({ key: k, item });
  }
  return out;
}

const sides = (row: DiffRow) => ({
  left: row.kind === 'insert' ? undefined : row.left,
  right: row.kind === 'delete' ? undefined : row.right,
});

/** Virtualized side-by-side or inline diff with collapsible unchanged regions. */
export function DiffView({
  rows,
  inline,
  collapse,
  wrap,
}: {
  rows: readonly DiffRow[];
  inline: boolean;
  collapse: boolean;
  wrap: boolean;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const items = useMemo(
    () =>
      collapse
        ? foldUnchanged(rows, 3, expanded)
        : rows.map((row, index) => ({ kind: 'row' as const, row, index })),
    [rows, collapse, expanded],
  );
  const visual = useMemo(() => toVisual(items, inline), [items, inline]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns non-memoizable functions, so the React Compiler skips this component (expected).
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: visual.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 22,
    overscan: 30,
    initialRect: { width: 1000, height: 600 },
  });

  const bg = {
    add: alpha(theme.palette.success.main, 0.12),
    del: alpha(theme.palette.error.main, 0.12),
    none: 'transparent',
  } as const;
  const gutter = {
    px: 1,
    color: 'text.disabled',
    textAlign: 'right',
    userSelect: 'none',
    borderRight: 1,
    borderColor: 'divider',
  } as const;
  const text = {
    px: 1,
    whiteSpace: wrap ? 'pre-wrap' : 'pre',
    overflowWrap: 'anywhere',
    minWidth: 0,
  } as const;

  const renderRow = (v: VisualRow) => {
    if (v.item.kind === 'fold') {
      const fold = v.item;
      return (
        <Box role="cell" sx={{ gridColumn: '1 / -1', bgcolor: 'action.hover', py: 0.25, px: 1 }}>
          <Button
            size="small"
            sx={{ py: 0, minHeight: 20, textTransform: 'none' }}
            onClick={() => {
              setExpanded(new Set([...expanded, fold.start]));
            }}
          >
            ⋯ Show {fold.count.toLocaleString()} unchanged lines
          </Button>
        </Box>
      );
    }
    const { row } = v.item;
    const { left, right } = sides(row);
    if (inline) {
      const tone: Tone =
        v.part === 'del' || row.kind === 'delete'
          ? 'del'
          : v.part === 'add' || row.kind === 'insert'
            ? 'add'
            : 'none';
      const line = tone === 'del' ? left : (right ?? left);
      const sign = tone === 'del' ? '−' : tone === 'add' ? '+' : ' ';
      return (
        <>
          <Box role="cell" sx={{ ...gutter, bgcolor: bg[tone] }}>
            {tone === 'add' ? '' : left?.no}
          </Box>
          <Box role="cell" sx={{ ...gutter, bgcolor: bg[tone] }}>
            {tone === 'del' ? '' : right?.no}
          </Box>
          <Box role="cell" sx={{ ...text, bgcolor: bg[tone] }}>
            <Box component="span" aria-hidden sx={{ color: 'text.disabled', mr: 1 }}>
              {sign}
            </Box>
            <LineText line={line} tone={tone} />
          </Box>
        </>
      );
    }
    const lt: Tone = row.kind === 'delete' || row.kind === 'change' ? 'del' : 'none';
    const rt: Tone = row.kind === 'insert' || row.kind === 'change' ? 'add' : 'none';
    return (
      <>
        <Box role="cell" sx={{ ...gutter, bgcolor: bg[lt] }}>
          {left?.no}
        </Box>
        <Box role="cell" sx={{ ...text, bgcolor: left ? bg[lt] : 'action.hover' }}>
          <LineText line={left} tone="del" />
        </Box>
        <Box
          role="cell"
          sx={{ ...gutter, bgcolor: bg[rt], borderLeft: 1, borderLeftColor: 'divider' }}
        >
          {right?.no}
        </Box>
        <Box role="cell" sx={{ ...text, bgcolor: right ? bg[rt] : 'action.hover' }}>
          <LineText line={right} tone="add" />
        </Box>
      </>
    );
  };

  const columns = inline ? '52px 52px 1fr' : '52px minmax(0, 1fr) 52px minmax(0, 1fr)';
  return (
    <Box
      ref={scrollRef}
      role="table"
      aria-label="Differences"
      aria-rowcount={visual.length}
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        fontFamily: fontFamilies.mono,
        fontSize: 13,
        lineHeight: '22px',
      }}
    >
      <Box
        sx={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          minWidth: wrap ? 0 : 'max-content',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const v = visual[vi.index];
          if (!v) return null;
          return (
            <Box
              key={v.key}
              role="row"
              data-index={vi.index}
              ref={virtualizer.measureElement}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${String(vi.start)}px)`,
                display: 'grid',
                gridTemplateColumns: columns,
              }}
            >
              {renderRow(v)}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
