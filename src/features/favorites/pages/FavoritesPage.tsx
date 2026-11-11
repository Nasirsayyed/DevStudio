import {
  Box,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import { Star1 } from 'iconsax-reactjs';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  EmptyState,
  LoadingState,
  PageContainer,
  SearchInput,
  SectionCard,
  ToolCard,
  ToolHeader,
  useNotify,
  ToolIcon,
} from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import { useFavoriteTools } from '@/hooks/useFavoriteTools';
import { getModule } from '@/tools/modules';
import { getToolModule, toolPath } from '@/tools/toolRegistry';
import { searchTools } from '@/tools/toolSearch';

export default function FavoritesPage() {
  const mod = getModule('favorites');
  const { tools, isFavorite, toggle, loading } = useFavoriteTools();
  const notify = useNotify();
  const [query, setQuery] = useState('');
  const browse = useMemo(() => searchTools(query), [query]);

  const onToggle = (toolId: string) => {
    toggle(toolId).catch((error: unknown) => {
      notify.error(toUserMessage(error));
    });
  };

  return (
    <PageContainer>
      <ToolHeader title={mod.title} description={mod.description} icon={mod.icon} />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            id="favorite-tools"
            title="Favorite tools"
            subtitle={`${tools.length} saved`}
          >
            {loading ? (
              <LoadingState minHeight={160} />
            ) : tools.length === 0 ? (
              <EmptyState
                dense
                icon={Star1}
                title="No favorites yet"
                description="Star tools from the list or from any tool's header to pin them here and on the dashboard."
              />
            ) : (
              <Grid container spacing={1.5}>
                {tools.map((tool) => (
                  <Grid key={tool.id} size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ position: 'relative' }}>
                      <ToolCard tool={tool} compact />
                      <Tooltip title="Remove from favorites">
                        <IconButton
                          size="small"
                          aria-label={`Remove ${tool.title} from favorites`}
                          onClick={() => {
                            onToggle(tool.id);
                          }}
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            right: 8,
                            transform: 'translateY(-50%)',
                            color: 'warning.main',
                          }}
                        >
                          <Star1 size={18} variant="Bold" color="currentColor" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            id="all-tools"
            title="All tools"
            subtitle="Star a tool to add it to favorites"
            flush
          >
            <Box sx={{ px: 2, pb: 1 }}>
              <SearchInput
                value={query}
                onChange={setQuery}
                label="Filter tools"
                debounceMs={0}
                fullWidth
              />
            </Box>
            <List dense sx={{ maxHeight: 520, overflowY: 'auto' }} aria-label="All tools">
              {browse.map((tool) => {
                const fav = isFavorite(tool.id);
                return (
                  <ListItem
                    key={tool.id}
                    disablePadding
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        aria-pressed={fav}
                        aria-label={
                          fav
                            ? `Remove ${tool.title} from favorites`
                            : `Add ${tool.title} to favorites`
                        }
                        onClick={() => {
                          onToggle(tool.id);
                        }}
                        sx={{ color: fav ? 'warning.main' : 'text.secondary' }}
                      >
                        <Star1 size={18} variant={fav ? 'Bold' : 'Linear'} color="currentColor" />
                      </IconButton>
                    }
                  >
                    <ListItemButton component={RouterLink} to={toolPath(tool)} sx={{ mx: 1 }}>
                      <ListItemIcon sx={{ minWidth: 34 }}>
                        <ToolIcon tool={tool} size={18} />
                      </ListItemIcon>
                      <ListItemText
                        primary={tool.title}
                        secondary={getToolModule(tool).title}
                        slotProps={{
                          primary: { sx: { fontSize: 13.5 } },
                          secondary: { sx: { fontSize: 11.5 } },
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </SectionCard>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
