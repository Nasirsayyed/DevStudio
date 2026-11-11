import type { ReactNode } from 'react';
import { type EditorMarker, type RevealRequest, SplitPane, ToolWorkspace } from '@/components';
import type { ParseError } from '@/core/errors/AppError';
import { requireTool } from '@/tools/toolRegistry';
import { useDocumentFromUrl } from '../hooks/useDocumentFromUrl';
import { useJsonStudioStore } from '../store';
import { JsonInputPanel } from './JsonInputPanel';

export interface JsonToolLayoutProps {
  toolId: string;
  toolbar?: ReactNode;
  sample?: string;
  inputError?: ParseError | null;
  inputValid?: boolean;
  inputMarkers?: readonly EditorMarker[];
  inputReveal?: RevealRequest | null;
  onRun?: () => void;
  /** Right-hand result area. */
  children: ReactNode;
}

/** Shared JSON input (left) + custom result view (right). */
export function JsonToolLayout({
  toolId,
  toolbar,
  sample,
  inputError,
  inputValid,
  inputMarkers,
  inputReveal,
  onRun,
  children,
}: JsonToolLayoutProps) {
  const tool = requireTool(toolId);
  useDocumentFromUrl();
  const input = useJsonStudioStore((s) => s.input);
  const setInput = useJsonStudioStore((s) => s.setInput);
  return (
    <ToolWorkspace tool={tool} toolbar={toolbar}>
      <SplitPane
        storageKey={toolId}
        first={
          <JsonInputPanel
            value={input}
            onChange={setInput}
            error={inputError ?? null}
            valid={inputValid}
            markers={inputMarkers}
            reveal={inputReveal}
            sample={sample}
            documents
            onRun={onRun}
          />
        }
        second={children}
      />
    </ToolWorkspace>
  );
}
