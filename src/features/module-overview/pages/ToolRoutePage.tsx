import { Stack } from '@mui/material';
import { Suspense } from 'react';
import { Navigate, useParams } from 'react-router';
import { LoadingState, PageContainer, ToolHeader } from '@/components';
import { useFavoriteTools } from '@/hooks/useFavoriteTools';
import { useToolUsageTracker } from '@/hooks/useToolUsageTracker';
import { getModule } from '@/tools/modules';
import { getTool, getToolBySlug, getToolIcon, toolPath } from '@/tools/toolRegistry';
import { ToolPageRenderer } from '@/tools/ToolPageRenderer';
import { isToolAvailable } from '@/tools/toolPages';
import type { ModuleId } from '@/types/tools';
import { ScheduledNotice } from '../components/ScheduledNotice';
import NotFoundPage from './NotFoundPage';

/** Resolves `/:module/:toolSlug` via the registry, then lazy-loads the tool page. */
export default function ToolRoutePage({ moduleId }: { moduleId: ModuleId }) {
  const { toolSlug = '' } = useParams();
  const tool = getToolBySlug(moduleId, toolSlug);
  const canonical = tool?.aliasOf ? getTool(tool.aliasOf) : undefined;
  const { isFavorite, toggle } = useFavoriteTools();

  useToolUsageTracker(tool && !canonical ? tool.id : undefined);

  if (!tool) return <NotFoundPage />;
  if (canonical) return <Navigate to={toolPath(canonical)} replace />;

  if (isToolAvailable(tool.id)) {
    return (
      <Suspense fallback={<LoadingState label={`Loading ${tool.title}…`} minHeight={400} />}>
        <ToolPageRenderer toolId={tool.id} />
      </Suspense>
    );
  }

  return (
    <PageContainer>
      <ToolHeader
        title={tool.title}
        description={tool.description}
        icon={getToolIcon(tool)}
        badge={getModule(moduleId).shortTitle}
        isFavorite={isFavorite(tool.id)}
        onToggleFavorite={() => void toggle(tool.id)}
      />
      <Stack spacing={2}>
        <ScheduledNotice phase={tool.phase} what={tool.title} />
      </Stack>
    </PageContainer>
  );
}
