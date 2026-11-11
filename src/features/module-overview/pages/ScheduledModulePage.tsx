import { PageContainer, ToolHeader } from '@/components';
import { getModule } from '@/tools/modules';
import type { ModuleId } from '@/types/tools';
import { ScheduledNotice } from '../components/ScheduledNotice';

/** Page for single-page modules (e.g. Snippets, History) that are scheduled for a later phase. */
export default function ScheduledModulePage({ moduleId }: { moduleId: ModuleId }) {
  const mod = getModule(moduleId);
  return (
    <PageContainer>
      <ToolHeader title={mod.title} description={mod.description} icon={mod.icon} />
      <ScheduledNotice phase={mod.phase} what={mod.title} />
    </PageContainer>
  );
}
