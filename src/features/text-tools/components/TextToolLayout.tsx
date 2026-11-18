import type { ReactNode } from 'react';
import { SplitPane, ToolWorkspace } from '@/components';
import { CompareWorkspace, type CompareWorkspaceProps } from '@/components/layout/CompareWorkspace';
import { requireTool } from '@/tools/toolRegistry';
import { useTextDraft } from '../hooks';

/** Input (left) → result (right), like the other workspaces. */
export function TextToolLayout({
  toolId,
  toolbar,
  actions,
  input,
  output,
}: {
  toolId: string;
  toolbar?: ReactNode;
  actions?: ReactNode;
  input: ReactNode;
  output: ReactNode;
}) {
  useTextDraft();
  return (
    <ToolWorkspace tool={requireTool(toolId)} toolbar={toolbar} actions={actions}>
      <SplitPane storageKey={toolId} first={input} second={output} />
    </ToolWorkspace>
  );
}

/** Two inputs on top, the comparison below, with the Text Tools draft restored. */
export function CompareLayout(props: CompareWorkspaceProps) {
  useTextDraft();
  return <CompareWorkspace {...props} />;
}
