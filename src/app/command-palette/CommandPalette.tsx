import {
  Box,
  Dialog,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  Typography,
} from '@mui/material';
import {
  Clock,
  Code1,
  Data,
  DocumentCode,
  Flash,
  Global,
  type Icon,
  SearchNormal1,
} from 'iconsax-reactjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { EmptyState, Kbd } from '@/components';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  type EntitySearchResult,
  type SearchEntityKind,
  searchRepository,
} from '@/services/db/repositories';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useUiStore } from '@/stores/uiStore';
import { MODULES } from '@/tools/modules';
import { getToolIcon, getToolModule, toolPath } from '@/tools/toolRegistry';
import { SHORTCUTS } from '../shortcuts';
import {
  type PaletteAction,
  type PaletteItem,
  buildPaletteGroups,
  entityPath,
  parsePaletteQuery,
} from './paletteModel';

const ENTITY_ICONS: Record<SearchEntityKind, Icon> = {
  request: Global,
  document: Code1,
  query: Data,
  snippet: DocumentCode,
  history: Clock,
};

const NO_RESULTS: EntitySearchResult[] = [];

/** Debounced IndexedDB search. Results are tagged with their query so stale ones are never shown. */
function useEntitySearch(query: string): EntitySearchResult[] {
  const debounced = useDebouncedValue(query, 150);
  const { actionsOnly, text } = parsePaletteQuery(debounced);
  const enabled = !actionsOnly && text.length >= 2;
  const [state, setState] = useState<{ text: string; results: EntitySearchResult[] }>({
    text: '',
    results: [],
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    searchRepository
      .search(text)
      .then((results) => {
        if (!cancelled) setState({ text, results });
      })
      .catch((error: unknown) => {
        console.warn('Palette search failed', error);
        if (!cancelled) setState({ text, results: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, text]);

  return enabled && state.text === text ? state.results : NO_RESULTS;
}

function useActions(close: () => void): PaletteAction[] {
  const navigate = useNavigate();
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const toggleSidebarCollapsed = usePreferencesStore((s) => s.toggleSidebarCollapsed);
  const setShortcutsDialogOpen = useUiStore((s) => s.setShortcutsDialogOpen);

  return useMemo<PaletteAction[]>(
    () => [
      ...MODULES.map((m) => ({
        id: `go:${m.id}`,
        title: `Go to ${m.title}`,
        keywords: ['navigate', 'open', m.shortTitle],
        run: () => void navigate(m.path),
      })),
      {
        id: 'theme:light',
        title: 'Switch to light theme',
        keywords: ['theme', 'appearance'],
        run: () => {
          setThemeMode('light');
        },
      },
      {
        id: 'theme:dark',
        title: 'Switch to dark theme',
        keywords: ['theme', 'appearance'],
        run: () => {
          setThemeMode('dark');
        },
      },
      {
        id: 'theme:system',
        title: 'Use system theme',
        keywords: ['theme', 'appearance', 'auto'],
        run: () => {
          setThemeMode('system');
        },
      },
      {
        id: 'sidebar:toggle',
        title: 'Toggle sidebar',
        keywords: ['collapse', 'expand', 'layout'],
        hint: SHORTCUTS.toggleSidebar.combo,
        run: toggleSidebarCollapsed,
      },
      {
        id: 'help:shortcuts',
        title: 'Show keyboard shortcuts',
        keywords: ['help', 'keys', 'hotkeys'],
        hint: SHORTCUTS.shortcutsHelp.combo,
        run: () => {
          close();
          setShortcutsDialogOpen(true);
        },
      },
    ],
    [navigate, setThemeMode, toggleSidebarCollapsed, setShortcutsDialogOpen, close],
  );
}

function itemPresentation(item: PaletteItem): {
  icon: Icon;
  title: string;
  subtitle?: string;
  hint?: string;
} {
  switch (item.type) {
    case 'tool':
      return {
        icon: getToolIcon(item.tool),
        title: item.tool.title,
        subtitle: getToolModule(item.tool).title,
      };
    case 'action':
      return {
        icon: Flash,
        title: item.action.title,
        ...(item.action.hint ? { hint: item.action.hint } : {}),
      };
    case 'entity':
      return {
        icon: ENTITY_ICONS[item.entity.kind],
        title: item.entity.title || 'Untitled',
        subtitle: item.entity.subtitle,
      };
  }
}

export default function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const initialQuery = useUiStore((s) => s.commandPaletteInitialQuery);
  const closePalette = useUiStore((s) => s.closeCommandPalette);
  const recentToolIds = usePreferencesStore((s) => s.recentToolIds);
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const actions = useActions(closePalette);
  const entities = useEntitySearch(query);
  const groups = useMemo(
    () => buildPaletteGroups({ query, actions, recentToolIds, entities }),
    [query, actions, recentToolIds, entities],
  );
  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const indexByKey = useMemo(() => new Map(flatItems.map((item, i) => [item.key, i])), [flatItems]);

  // Reset the selection whenever the result set changes.
  const [prevItems, setPrevItems] = useState(flatItems);
  if (prevItems !== flatItems) {
    setPrevItems(flatItems);
    setActiveIndex(0);
  }

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const execute = (item: PaletteItem | undefined) => {
    if (!item) return;
    closePalette();
    if (item.type === 'tool') void navigate(toolPath(item.tool));
    else if (item.type === 'entity') void navigate(entityPath(item.entity));
    else item.action.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const count = flatItems.length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (count) setActiveIndex((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) setActiveIndex((i) => (i - 1 + count) % count);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(Math.max(0, count - 1));
        break;
      case 'Enter':
        event.preventDefault();
        execute(flatItems[activeIndex]);
        break;
      default:
        break;
    }
  };

  const optionId = (i: number) => `palette-option-${i}`;

  return (
    <Dialog
      open={open}
      onClose={closePalette}
      fullWidth
      maxWidth="sm"
      aria-label="Command palette"
      slotProps={{
        paper: {
          sx: {
            position: 'fixed',
            top: { xs: 16, sm: '12vh' },
            m: { xs: 1, sm: 4 },
            maxHeight: { xs: 'calc(100dvh - 32px)', sm: '70vh' },
          },
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <SearchNormal1 size={20} color="currentColor" aria-hidden />
        <InputBase
          autoFocus
          fullWidth
          value={query}
          placeholder='Search tools and saved work… (type ">" for actions)'
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          onKeyDown={onKeyDown}
          inputProps={{
            role: 'combobox',
            'aria-label': 'Search command palette',
            'aria-expanded': true,
            'aria-controls': 'palette-listbox',
            'aria-autocomplete': 'list',
            'aria-activedescendant': flatItems.length ? optionId(activeIndex) : undefined,
          }}
          sx={{ fontSize: 15 }}
        />
        <Kbd combo="esc" size="small" />
      </Stack>
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        {flatItems.length === 0 ? (
          <EmptyState
            dense
            icon={SearchNormal1}
            title="No results"
            description="Try a different keyword, or type “>” to browse actions."
          />
        ) : (
          <List
            id="palette-listbox"
            role="listbox"
            aria-label="Results"
            ref={listRef}
            dense
            sx={{ py: 1 }}
          >
            {groups.map((group) => (
              <li key={group.id} role="presentation">
                <ul role="group" aria-label={group.label} style={{ padding: 0, margin: 0 }}>
                  <ListSubheader
                    role="presentation"
                    sx={{
                      lineHeight: '30px',
                      typography: 'overline',
                      color: 'text.secondary',
                      bgcolor: 'background.paper',
                    }}
                  >
                    {group.label}
                  </ListSubheader>
                  {group.items.map((item) => {
                    const index = indexByKey.get(item.key) ?? 0;
                    const selected = index === activeIndex;
                    const p = itemPresentation(item);
                    const IconComponent = p.icon;
                    return (
                      <ListItemButton
                        key={item.key}
                        id={optionId(index)}
                        role="option"
                        aria-selected={selected}
                        selected={selected}
                        tabIndex={-1}
                        onMouseMove={() => {
                          if (!selected) setActiveIndex(index);
                        }}
                        onClick={() => {
                          execute(item);
                        }}
                        sx={{ mx: 1, py: 0.75 }}
                      >
                        <ListItemIcon
                          sx={{ minWidth: 34, color: selected ? 'primary.main' : 'text.secondary' }}
                        >
                          <IconComponent
                            size={18}
                            color="currentColor"
                            variant={selected ? 'Bulk' : 'Linear'}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={p.title}
                          secondary={p.subtitle}
                          slotProps={{
                            primary: { noWrap: true, sx: { fontSize: 13.5, fontWeight: 550 } },
                            secondary: { noWrap: true, sx: { fontSize: 11.5 } },
                          }}
                        />
                        {p.hint && <Kbd combo={p.hint} size="small" />}
                      </ListItemButton>
                    );
                  })}
                </ul>
              </li>
            ))}
          </List>
        )}
      </Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', color: 'text.secondary' }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Kbd combo="↑" size="small" />
          <Kbd combo="↓" size="small" />
          <Typography variant="caption">navigate</Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Kbd combo="enter" size="small" />
          <Typography variant="caption">open</Typography>
        </Stack>
      </Stack>
    </Dialog>
  );
}
