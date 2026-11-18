import { Grid, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { EmptyState, PageContainer, SearchInput, ToolCard, ToolHeader } from '@/components';
import { getModule } from '@/tools/modules';
import { getToolsByModule } from '@/tools/toolRegistry';
import { searchTools } from '@/tools/toolSearch';
import type { ModuleId, ToolDefinition } from '@/types/tools';
import { SearchNormal1 } from 'iconsax-reactjs';

function groupTools(tools: ToolDefinition[]): [string, ToolDefinition[]][] {
  const groups = new Map<string, ToolDefinition[]>();
  for (const t of tools) {
    const key = t.group ?? '';
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()];
}

/** Landing page of a multi-tool module: searchable tool grid, grouped. */
export default function ModuleOverviewPage({ moduleId }: { moduleId: ModuleId }) {
  const mod = getModule(moduleId);
  const [query, setQuery] = useState('');
  const tools = useMemo(() => getToolsByModule(moduleId), [moduleId]);
  const filtered = useMemo(() => searchTools(query, { tools }), [query, tools]);
  const grouped = useMemo(
    () => (query ? [['', filtered] as [string, ToolDefinition[]]] : groupTools(filtered)),
    [query, filtered],
  );

  return (
    <PageContainer>
      <ToolHeader
        title={mod.title}
        description={mod.description}
        icon={mod.icon}
        actions={
          <SearchInput
            value={query}
            onChange={setQuery}
            label={`Search ${mod.shortTitle} tools`}
            debounceMs={0}
            sx={{ width: { xs: '100%', sm: 260 } }}
          />
        }
      />
      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchNormal1}
          title="No matching tools"
          description={`Nothing in ${mod.title} matches “${query}”.`}
        />
      ) : (
        <Stack spacing={3}>
          {grouped.map(([group, items]) => (
            <section key={group || 'all'} aria-label={group || `${mod.title} tools`}>
              {group && (
                <Typography
                  variant="overline"
                  color="text.secondary"
                  component="h2"
                  sx={{ display: 'block', mb: 1 }}
                >
                  {group}
                </Typography>
              )}
              <Grid container spacing={2}>
                {items.map((tool) => (
                  <Grid key={tool.id} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
                    <ToolCard tool={tool} />
                  </Grid>
                ))}
              </Grid>
            </section>
          ))}
        </Stack>
      )}
    </PageContainer>
  );
}
