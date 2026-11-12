import { alpha, Box, Chip, Stack, Typography } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatDistanceToNowStrict } from 'date-fns';
import { Star1 } from 'iconsax-reactjs';
import { type KeyboardEvent, useRef } from 'react';
import { languageLabel } from '@/core/languages/languages';
import { fontFamilies } from '@/theme/tokens';
import type { CodeSnippetEntity } from '@/types/entities';

const ROW_HEIGHT = 84;

function firstCodeLine(code: string): string {
  return (
    code
      .split(/\r\n|\r|\n/)
      .find((l) => l.trim() !== '')
      ?.trim() ?? ''
  );
}

/** Virtualized list of snippets (listbox: ↑ ↓ Home End to move, Enter to open). */
export function SnippetList({
  snippets,
  selectedId,
  onSelect,
}: {
  snippets: readonly CodeSnippetEntity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns non-memoizable functions, so the React Compiler skips this component (expected).
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: snippets.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    initialRect: { width: 360, height: 700 },
  });
  const selectedIndex = snippets.findIndex((s) => s.id === selectedId);

  const onKeyDown = (e: KeyboardEvent) => {
    const move = (i: number) => {
      const next = snippets[Math.max(0, Math.min(snippets.length - 1, i))];
      if (!next) return;
      e.preventDefault();
      onSelect(next.id);
      virtualizer.scrollToIndex(snippets.indexOf(next), { align: 'auto' });
    };
    if (e.key === 'ArrowDown') move(selectedIndex + 1);
    else if (e.key === 'ArrowUp') move(selectedIndex <= 0 ? 0 : selectedIndex - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(snippets.length - 1);
  };

  return (
    <Box
      ref={scrollRef}
      role="listbox"
      aria-label="Snippets"
      tabIndex={0}
      aria-activedescendant={
        selectedIndex >= 0 ? `snippet-${snippets[selectedIndex]?.id ?? ''}` : undefined
      }
      onKeyDown={onKeyDown}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        outline: 'none',
        '&:focus-visible': { boxShadow: (t) => `inset 0 0 0 2px ${t.palette.primary.main}` },
      }}
    >
      <Box sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const s = snippets[vi.index];
          if (!s) return null;
          const selected = s.id === selectedId;
          return (
            <Box
              key={s.id}
              id={`snippet-${s.id}`}
              role="option"
              aria-selected={selected}
              aria-label={s.title}
              onClick={() => {
                onSelect(s.id);
              }}
              sx={(t) => ({
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
                transform: `translateY(${String(vi.start)}px)`,
                px: 1.5,
                py: 1,
                cursor: 'pointer',
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: selected ? alpha(t.palette.primary.main, 0.1) : 'transparent',
                borderLeft: 3,
                borderLeftColor: selected ? 'primary.main' : 'transparent',
                '&:hover': {
                  bgcolor: selected ? alpha(t.palette.primary.main, 0.14) : 'action.hover',
                },
              })}
            >
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                {s.isFavorite === 1 && (
                  <Star1 size={14} variant="Bold" color="#f5a524" aria-label="Favorite" />
                )}
                <Typography variant="body2" noWrap sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                  {s.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {formatDistanceToNowStrict(s.updatedAt, { addSuffix: true })}
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                component="div"
                noWrap
                color="text.secondary"
                sx={{ fontFamily: fontFamilies.mono, mt: 0.25 }}
              >
                {firstCodeLine(s.code)}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, overflow: 'hidden' }}>
                <Chip
                  size="small"
                  label={languageLabel(s.language)}
                  sx={{ height: 18, fontSize: 11 }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={s.category}
                  sx={{ height: 18, fontSize: 11 }}
                />
                {s.tags.slice(0, 3).map((t) => (
                  <Chip
                    key={t}
                    size="small"
                    variant="outlined"
                    label={`#${t}`}
                    sx={{ height: 18, fontSize: 11 }}
                  />
                ))}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
