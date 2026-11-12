import type { ReactNode } from 'react';
import { SplitPane, ToolWorkspace } from '@/components';
import { CompareWorkspace, type CompareWorkspaceProps } from '@/components/layout/CompareWorkspace';
import { requireTool } from '@/tools/toolRegistry';
import { useSqlWorkspace } from '../hooks';

/** Input (left) → result (right), with the SQL draft and `?query=` links handled. */
export function SqlLayout({
  toolId,
  toolbar,
  input,
  output,
}: {
  toolId: string;
  toolbar?: ReactNode;
  input: ReactNode;
  output: ReactNode;
}) {
  useSqlWorkspace();
  return (
    <ToolWorkspace tool={requireTool(toolId)} toolbar={toolbar}>
      <SplitPane storageKey={toolId} first={input} second={output} />
    </ToolWorkspace>
  );
}

export function SqlCompareLayout(props: CompareWorkspaceProps) {
  useSqlWorkspace();
  return <CompareWorkspace {...props} />;
}
