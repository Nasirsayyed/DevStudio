import { Button, Grid, Stack, Typography } from '@mui/material';
import { Chart2, Clock, Code1, Data, DocumentCode, Element3, Global, Star1 } from 'iconsax-reactjs';
import { Suspense, lazy, useMemo } from 'react';
import { Link as RouterLink } from 'react-router';
import { EmptyState, LoadingState, PageContainer, SectionCard } from '@/components';
import { formatBytes } from '@/core/format/bytes';
import { useFavoriteTools } from '@/hooks/useFavoriteTools';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { MODULES } from '@/tools/modules';
import { CANONICAL_TOOLS, resolveTools } from '@/tools/toolRegistry';
import { QuickAccessCard } from '../components/QuickAccessCard';
import { RecentItemsCard } from '../components/RecentItemsCard';
import { StatCard } from '../components/StatCard';
import { ToolList } from '../components/ToolList';
import { ToolSearchCard } from '../components/ToolSearchCard';
import { useDashboardData } from '../hooks/useDashboardData';

const UsageChart = lazy(() => import('../components/UsageChart'));

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 5) return 'Working late?';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { counts, recentRequests, recentDocuments, recentSnippets, topTools, totalUses } =
    useDashboardData();
  const { tools: favoriteTools } = useFavoriteTools();
  const recentToolIds = usePreferencesStore((s) => s.recentToolIds);
  const recentTools = useMemo(() => resolveTools(recentToolIds).slice(0, 6), [recentToolIds]);
  const greeting = useMemo(() => greetingFor(new Date()), []);
  const toolModuleCount = MODULES.filter((m) => m.hasTools).length;

  return (
    <PageContainer>
      <Stack spacing={3}>
        <ToolSearchCard greeting={greeting} />

        <Grid container spacing={2} component="section" aria-label="Workspace statistics">
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard
              label="Tools"
              value={CANONICAL_TOOLS.length}
              hint={`${toolModuleCount} modules`}
              icon={Element3}
              to="/favorites"
              colorIndex={0}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard
              label="Favorites"
              value={counts?.favorites}
              icon={Star1}
              to="/favorites"
              colorIndex={2}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard
              label="API requests"
              value={counts?.apiRequests}
              hint={counts ? `${counts.collections} collections` : undefined}
              icon={Global}
              to="/api"
              colorIndex={1}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard
              label="JSON docs"
              value={counts?.jsonDocuments}
              icon={Code1}
              to="/json"
              colorIndex={3}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard
              label="Snippets"
              value={counts?.codeSnippets}
              icon={DocumentCode}
              to="/snippets"
              colorIndex={4}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard
              label="SQL scripts"
              value={counts?.savedQueries}
              icon={Data}
              to="/sql"
              colorIndex={5}
            />
          </Grid>
        </Grid>

        <QuickAccessCard />

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <SectionCard id="recent-tools" title="Recently used" flush>
              {recentTools.length === 0 ? (
                <EmptyState
                  dense
                  icon={Clock}
                  title="Nothing yet"
                  description="Tools you open will show up here."
                />
              ) : (
                <ToolList tools={recentTools} ariaLabel="Recently used tools" />
              )}
            </SectionCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <SectionCard
              id="favorite-tools"
              title="Favorite tools"
              flush
              action={
                <Button size="small" component={RouterLink} to="/favorites">
                  Manage
                </Button>
              }
            >
              {favoriteTools.length === 0 ? (
                <EmptyState
                  dense
                  icon={Star1}
                  title="No favorites"
                  description="Star a tool to pin it here."
                />
              ) : (
                <ToolList tools={favoriteTools.slice(0, 6)} ariaLabel="Favorite tools" />
              )}
            </SectionCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <SectionCard
              id="usage"
              title="Tool usage"
              subtitle={totalUses ? `${totalUses} tool opens recorded on this device` : undefined}
            >
              {topTools === undefined ? (
                <LoadingState minHeight={160} />
              ) : topTools.length === 0 ? (
                <EmptyState
                  dense
                  icon={Chart2}
                  title="No usage yet"
                  description="Statistics appear as you use tools."
                />
              ) : (
                <Suspense fallback={<LoadingState minHeight={160} label="Loading chart…" />}>
                  <UsageChart usage={topTools} />
                </Suspense>
              )}
            </SectionCard>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <RecentItemsCard
              id="recent-requests"
              title="Recent API requests"
              items={recentRequests?.map((r) => ({
                id: r.id,
                title: `${r.method} ${r.url}`,
                subtitle:
                  r.status === null ? 'No response' : `${r.status} · ${r.durationMs ?? '—'} ms`,
                timestamp: r.createdAt,
                to: `/api/history?entry=${encodeURIComponent(r.id)}`,
              }))}
              emptyIcon={Global}
              emptyTitle="No requests yet"
              emptyDescription="Requests you send from API Testing will appear here."
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <RecentItemsCard
              id="saved-json"
              title="Saved JSON documents"
              items={recentDocuments?.map((d) => ({
                id: d.id,
                title: d.name,
                subtitle: formatBytes(d.sizeBytes),
                timestamp: d.updatedAt,
                to: `/json/formatter?document=${encodeURIComponent(d.id)}`,
              }))}
              emptyIcon={Code1}
              emptyTitle="No saved documents"
              emptyDescription="Documents you save in JSON Studio will appear here."
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <RecentItemsCard
              id="saved-snippets"
              title="Saved snippets"
              items={recentSnippets?.map((s) => ({
                id: s.id,
                title: s.title,
                subtitle: [s.language, ...s.tags].join(' · '),
                timestamp: s.updatedAt,
                to: `/snippets?snippet=${encodeURIComponent(s.id)}`,
              }))}
              emptyIcon={DocumentCode}
              emptyTitle="No snippets yet"
              emptyDescription="Snippets you save in the Snippet Manager will appear here."
            />
          </Grid>
        </Grid>

        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ textAlign: 'center' }}
        >
          Everything on this page is computed from data stored locally in your browser.
        </Typography>
      </Stack>
    </PageContainer>
  );
}
