import { Box, Button, ButtonGroup, Stack, Typography, useTheme } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowRight2 } from 'iconsax-reactjs';
import { type KeyboardEvent, memo, useEffect, useMemo, useRef, useState } from 'react';
import { toJsonPointer } from '@/core/json/path';
import { type TreeRow, ancestorIds, buildTreeRows, collectContainerIds } from '@/core/json/tree';
import type { JsonValue, PathSegment } from '@/core/json/types';
import { formatCount } from '@/core/format/bytes';
import { fontFamilies } from '@/theme/tokens';

export interface JsonViewerProps {
  value: JsonValue;
  ariaLabel: string;
  /** Path of the selected node (controlled). */
  selectedPath?: readonly PathSegment[] | null;
  onSelect?: (path: PathSegment[]) => void;
  /** Initially expanded depth. */
  defaultExpandDepth?: number;
  /** Case-insensitive text highlighted in keys and values. */
  highlight?: string;
}

const ROW_HEIGHT = 26;
const INDENT = 16;
const EXPAND_ALL_LIMIT = 100_000;

function useTypeColors() {
  const t = useTheme().tokens;
  const dark = useTheme().palette.mode === 'dark';
  return {
    key: dark ? '#a5b4fc' : '#4f46e5',
    string: dark ? '#86efac' : '#15803d',
    number: dark ? '#fbbf24' : '#b45309',
    boolean: dark ? '#f9a8d4' : '#be185d',
    null: t.textMuted,
    object: t.textMuted,
    array: t.textMuted,
  } as const;
}

function Highlighted({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <Box
        component="mark"
        sx={{ bgcolor: 'warning.main', color: 'common.black', borderRadius: 0.5, px: 0.25 }}
      >
        {text.slice(i, i + query.length)}
      </Box>
      {text.slice(i + query.length)}
    </>
  );
}

interface RowProps {
  row: TreeRow;
  selected: boolean;
  active: boolean;
  colors: ReturnType<typeof useTypeColors>;
  highlight?: string;
  onToggle: (row: TreeRow) => void;
  onSelect: (row: TreeRow, index: number) => void;
  index: number;
  domId: string;
}

const Row = memo(function Row({
  row,
  selected,
  active,
  colors,
  highlight,
  onToggle,
  onSelect,
  index,
  domId,
}: RowProps) {
  return (
    <Box
      id={domId}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={row.expandable ? row.expanded : undefined}
      aria-selected={selected}
      onClick={() => {
        onSelect(row, index);
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: ROW_HEIGHT,
        pl: `${8 + row.depth * INDENT}px`,
        pr: 1,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: fontFamilies.mono,
        fontSize: 12.5,
        bgcolor: selected ? 'action.selected' : active ? 'action.hover' : 'transparent',
        outline: active ? 1 : 0,
        outlineColor: 'primary.main',
        outlineOffset: -1,
        '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
      }}
    >
      <Box
        component="span"
        aria-hidden
        onClick={(e) => {
          if (!row.expandable) return;
          e.stopPropagation();
          onToggle(row);
        }}
        sx={{
          width: 16,
          display: 'inline-flex',
          flexShrink: 0,
          color: 'text.secondary',
          transform: row.expanded ? 'rotate(90deg)' : 'none',
          transition: 'transform 100ms',
          visibility: row.expandable ? 'visible' : 'hidden',
        }}
      >
        <ArrowRight2 size={12} color="currentColor" />
      </Box>
      {row.name !== null && (
        <Box
          component="span"
          sx={{ color: typeof row.name === 'number' ? colors.number : colors.key, mr: 0.75 }}
        >
          {typeof row.name === 'number' ? (
            row.name
          ) : (
            <Highlighted text={JSON.stringify(row.name)} query={highlight} />
          )}
          <Box component="span" sx={{ color: 'text.secondary' }}>
            :
          </Box>
        </Box>
      )}
      <Box
        component="span"
        sx={{ color: colors[row.type], overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {row.type === 'object' || row.type === 'array' ? (
          <Box component="span" sx={{ fontSize: 11.5 }}>
            {row.type === 'array' ? `Array[${row.childCount}]` : `Object{${row.childCount}}`}
          </Box>
        ) : (
          <Highlighted text={row.preview} query={highlight} />
        )}
      </Box>
    </Box>
  );
});

/**
 * Virtualized, keyboard-accessible JSON tree (WAI-ARIA tree pattern).
 * Renders only visible rows, so documents with hundreds of thousands of
 * nodes stay responsive.
 */
export function JsonViewer({
  value,
  ariaLabel,
  selectedPath,
  onSelect,
  defaultExpandDepth = 1,
  highlight,
}: JsonViewerProps) {
  const colors = useTypeColors();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    collectContainerIds(value, defaultExpandDepth - 1),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setExpanded(collectContainerIds(value, defaultExpandDepth - 1));
    setActiveIndex(0);
  }

  const selectedId = selectedPath ? toJsonPointer(selectedPath) : null;

  // Reveal an externally selected node by expanding its ancestors.
  const [prevSelected, setPrevSelected] = useState(selectedId);
  if (prevSelected !== selectedId) {
    setPrevSelected(selectedId);
    if (selectedPath) {
      const missing = ancestorIds(selectedPath).filter((id) => !expanded.has(id));
      if (missing.length) setExpanded(new Set([...expanded, ...missing]));
    }
  }

  const rows = useMemo(() => buildTreeRows(value, expanded), [value, expanded]);
  // TanStack Virtual returns non-memoizable functions, so the React Compiler skips this component (expected).
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
    initialRect: { width: 800, height: 600 },
  });

  const selectedIndex = selectedId === null ? -1 : rows.findIndex((r) => r.id === selectedId);
  useEffect(() => {
    if (selectedIndex >= 0) virtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
  }, [selectedIndex, virtualizer]);

  const toggle = (row: TreeRow) => {
    const next = new Set(expanded);
    if (next.has(row.id)) next.delete(row.id);
    else next.add(row.id);
    setExpanded(next);
  };
  const select = (row: TreeRow, index: number) => {
    setActiveIndex(index);
    onSelect?.(row.path);
  };
  const move = (index: number) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, index));
    setActiveIndex(clamped);
    virtualizer.scrollToIndex(clamped, { align: 'auto' });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const row = rows[activeIndex];
    if (!row) return;
    switch (e.key) {
      case 'ArrowDown':
        move(activeIndex + 1);
        break;
      case 'ArrowUp':
        move(activeIndex - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(rows.length - 1);
        break;
      case 'ArrowRight':
        if (row.expandable && !row.expanded) toggle(row);
        else if (row.expanded) move(activeIndex + 1);
        break;
      case 'ArrowLeft':
        if (row.expanded) toggle(row);
        else if (row.depth > 0)
          move(rows.findLastIndex((r, i) => i < activeIndex && r.depth === row.depth - 1));
        break;
      case 'Enter':
      case ' ':
        select(row, activeIndex);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const expandTo = (depth: number) => {
    setExpanded(collectContainerIds(value, depth - 1, EXPAND_ALL_LIMIT));
  };
  const domId = (i: number) => `${ariaLabel.replace(/\W+/g, '-')}-row-${i}`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          px: 1,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          flexWrap: 'wrap',
          rowGap: 0.5,
        }}
      >
        <ButtonGroup size="small" variant="outlined" aria-label="Expand or collapse">
          <Button
            onClick={() => {
              expandTo(Number.POSITIVE_INFINITY);
            }}
          >
            Expand all
          </Button>
          <Button
            onClick={() => {
              setExpanded(new Set());
            }}
          >
            Collapse all
          </Button>
        </ButtonGroup>
        <ButtonGroup size="small" variant="text" aria-label="Expand to level">
          {[1, 2, 3].map((d) => (
            <Button
              key={d}
              onClick={() => {
                expandTo(d);
              }}
              aria-label={`Expand to level ${d}`}
            >
              L{d}
            </Button>
          ))}
        </ButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important' }}>
          {formatCount(rows.length)} visible rows
        </Typography>
      </Stack>
      <Box
        ref={scrollRef}
        role="tree"
        aria-label={ariaLabel}
        tabIndex={0}
        aria-activedescendant={rows.length ? domId(activeIndex) : undefined}
        onKeyDown={onKeyDown}
        sx={{
          flex: 1,
          minHeight: 120,
          overflow: 'auto',
          outline: 'none',
          '&:focus-visible': { boxShadow: (t) => `inset 0 0 0 2px ${t.palette.primary.main}` },
        }}
      >
        <Box
          sx={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
            minWidth: 'max-content',
            width: '100%',
          }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index] as TreeRow;
            return (
              <Box
                key={row.id}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <Row
                  row={row}
                  index={item.index}
                  domId={domId(item.index)}
                  selected={row.id === selectedId}
                  active={item.index === activeIndex}
                  colors={colors}
                  highlight={highlight}
                  onToggle={toggle}
                  onSelect={select}
                />
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
