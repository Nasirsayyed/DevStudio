import {
  Box,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { DocumentCode, More, Star1 } from 'iconsax-reactjs';
import { useState } from 'react';
import { languageLabel } from '@/core/languages/languages';
import type { SnippetFacets, SnippetFilter } from '@/core/snippets/search';

type FilterPatch = Partial<Pick<SnippetFilter, 'category' | 'language' | 'tag' | 'favoritesOnly'>>;

const CLEAR: FilterPatch = { category: null, language: null, tag: null, favoritesOnly: false };

function Item({
  label,
  count,
  selected,
  onClick,
  icon,
  action,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <ListItemButton
      dense
      selected={selected}
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
      sx={{
        borderRadius: 1.5,
        mx: 0.75,
        pr: action ? 0.5 : 1.5,
        '&:hover .row-action': { opacity: 1 },
      }}
    >
      {icon && (
        <Box sx={{ display: 'flex', mr: 1, color: 'text.secondary' }} aria-hidden>
          {icon}
        </Box>
      )}
      <ListItemText
        primary={label}
        slotProps={{ primary: { noWrap: true, sx: { fontSize: 14 } } }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
        {count}
      </Typography>
      {action}
    </ListItemButton>
  );
}

/** Library navigation: all, favorites, categories (rename/delete), languages and tags. */
export function SnippetFilters({
  facets,
  filter,
  onChange,
  onRenameCategory,
  onDeleteCategory,
}: {
  facets: SnippetFacets;
  filter: SnippetFilter;
  onChange: (patch: FilterPatch) => void;
  onRenameCategory: (name: string) => void;
  onDeleteCategory: (name: string) => void;
}) {
  const [menu, setMenu] = useState<{ el: HTMLElement; name: string } | null>(null);
  const none =
    !filter.favoritesOnly &&
    filter.category === null &&
    filter.language === null &&
    filter.tag === null;
  const header = (text: string) => (
    <ListSubheader
      disableSticky
      sx={{
        lineHeight: '32px',
        bgcolor: 'transparent',
        fontSize: 12,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      {text}
    </ListSubheader>
  );
  return (
    <Box component="nav" aria-label="Snippet filters" sx={{ overflowY: 'auto', py: 1 }}>
      <List dense disablePadding>
        <Item
          label="All snippets"
          count={facets.total}
          selected={none}
          onClick={() => {
            onChange(CLEAR);
          }}
          icon={<DocumentCode size={16} color="currentColor" />}
        />
        <Item
          label="Favorites"
          count={facets.favorites}
          selected={filter.favoritesOnly}
          onClick={() => {
            onChange({ ...CLEAR, favoritesOnly: true });
          }}
          icon={<Star1 size={16} color="currentColor" />}
        />
      </List>
      {facets.categories.length > 0 && (
        <List dense disablePadding subheader={header('Categories')}>
          {facets.categories.map((c) => (
            <Item
              key={c.name}
              label={c.name}
              count={c.count}
              selected={filter.category === c.name}
              onClick={() => {
                onChange({ ...CLEAR, category: c.name });
              }}
              action={
                <IconButton
                  className="row-action"
                  size="small"
                  aria-label={`Category actions for ${c.name}`}
                  sx={{ opacity: { xs: 1, md: 0 }, ml: 0.25, '&:focus-visible': { opacity: 1 } }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu({ el: e.currentTarget, name: c.name });
                  }}
                >
                  <More size={14} color="currentColor" />
                </IconButton>
              }
            />
          ))}
        </List>
      )}
      {facets.languages.length > 0 && (
        <List dense disablePadding subheader={header('Languages')}>
          {facets.languages.map((l) => (
            <Item
              key={l.name}
              label={languageLabel(l.name)}
              count={l.count}
              selected={filter.language === l.name}
              onClick={() => {
                onChange({ ...CLEAR, language: l.name });
              }}
            />
          ))}
        </List>
      )}
      {facets.tags.length > 0 && (
        <Box sx={{ px: 1.5, pt: 1 }}>
          <Typography
            component="h2"
            sx={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: 'text.secondary',
              mb: 1,
              px: 0.5,
            }}
          >
            Tags
          </Typography>
          <Stack
            direction="row"
            useFlexGap
            spacing={0.5}
            sx={{ flexWrap: 'wrap' }}
            aria-label="Tags"
          >
            {facets.tags.slice(0, 60).map((t) => (
              <Chip
                key={t.name}
                size="small"
                label={`${t.name} ${String(t.count)}`}
                aria-pressed={filter.tag === t.name}
                color={filter.tag === t.name ? 'primary' : 'default'}
                variant={filter.tag === t.name ? 'filled' : 'outlined'}
                onClick={() => {
                  onChange({ ...CLEAR, tag: filter.tag === t.name ? null : t.name });
                }}
              />
            ))}
          </Stack>
        </Box>
      )}
      <Menu
        anchorEl={menu?.el}
        open={menu !== null}
        onClose={() => {
          setMenu(null);
        }}
      >
        <MenuItem
          onClick={() => {
            if (menu) onRenameCategory(menu.name);
            setMenu(null);
          }}
        >
          Rename category…
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) onDeleteCategory(menu.name);
            setMenu(null);
          }}
        >
          Delete category…
        </MenuItem>
      </Menu>
    </Box>
  );
}
