import { Box, useMediaQuery, useTheme } from '@mui/material';
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react';

export interface SplitPaneProps {
  first: ReactNode;
  second: ReactNode;
  /** Persists the user's ratio per tool (per browser, best effort). */
  storageKey?: string;
  defaultRatio?: number;
  /** Minimum pane size in px. */
  minSize?: number;
  /** Accessible label for the resize handle. */
  label?: string;
  /** Height of each pane when stacked on small screens. */
  stackedPaneHeight?: number | string;
}

const STORAGE_PREFIX = 'devstudio:split:';

function readRatio(key: string | undefined, fallback: number): number {
  if (!key) return fallback;
  try {
    const raw = Number(window.localStorage.getItem(STORAGE_PREFIX + key));
    return raw > 0.05 && raw < 0.95 ? raw : fallback;
  } catch {
    return fallback;
  }
}

function writeRatio(key: string | undefined, ratio: number): void {
  if (!key) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, ratio.toFixed(3));
  } catch {
    // Storage unavailable: the ratio simply isn't remembered.
  }
}

/**
 * Two resizable panes side by side (md and up) or stacked (small screens).
 * The handle supports pointer dragging, arrow keys, Home/End and double-click reset.
 */
export function SplitPane({
  first,
  second,
  storageKey,
  defaultRatio = 0.5,
  minSize = 240,
  label = 'Resize panes',
  stackedPaneHeight = '60vh',
}: SplitPaneProps) {
  const theme = useTheme();
  const sideBySide = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatioState] = useState(() => readRatio(storageKey, defaultRatio));
  const [dragging, setDragging] = useState(false);

  const setRatio = useCallback(
    (next: number) => {
      const width = containerRef.current?.getBoundingClientRect().width ?? 0;
      const min = width > 0 ? Math.min(0.45, minSize / width) : 0.1;
      const clamped = Math.min(1 - min, Math.max(min, next));
      setRatioState(clamped);
      writeRatio(storageKey, clamped);
    },
    [minSize, storageKey],
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) setRatio((e.clientX - rect.left) / rect.width);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft') setRatio(ratio - step);
    else if (e.key === 'ArrowRight') setRatio(ratio + step);
    else if (e.key === 'Home') setRatio(0);
    else if (e.key === 'End') setRatio(1);
    else return;
    e.preventDefault();
  };

  if (!sideBySide) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box
          sx={{
            height: stackedPaneHeight,
            minHeight: 280,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {first}
        </Box>
        <Box
          sx={{
            height: stackedPaneHeight,
            minHeight: 280,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {second}
        </Box>
      </Box>
    );
  }

  const percent = Math.round(ratio * 100);
  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        userSelect: dragging ? 'none' : undefined,
      }}
    >
      <Box
        sx={{
          flex: `0 0 calc(${ratio * 100}% - 6px)`,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {first}
      </Box>
      <Box
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        onDoubleClick={() => {
          setRatio(defaultRatio);
        }}
        sx={{
          flex: '0 0 12px',
          cursor: 'col-resize',
          display: 'flex',
          justifyContent: 'center',
          touchAction: 'none',
          outline: 'none',
          '&::after': {
            content: '""',
            width: 3,
            my: 1,
            borderRadius: 2,
            bgcolor: dragging ? 'primary.main' : 'divider',
            transition: 'background-color 120ms',
          },
          '&:hover::after, &:focus-visible::after': { bgcolor: 'primary.main' },
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{second}</Box>
    </Box>
  );
}
