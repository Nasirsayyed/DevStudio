import type { ReactNode } from 'react';
import { JsonInputPanel } from '@/components/workspace/JsonInputPanel';
import type { ParseError } from '@/core/errors/AppError';
import { type FileRules, TEXT_FILE_RULES } from '@/core/files/fileValidation';
import type { EditorMarker } from '@/components';
import { type TextWorkspaceState, useTextWorkspaceStore } from '@/stores/textWorkspaceStore';

type Field = Exclude<keyof TextWorkspaceState, 'set'>;

/** Editor bound to a field of the shared text workspace (file open, sample, clear, size). */
export function TextInput({
  field,
  title = 'Input',
  language = 'plaintext',
  rules = TEXT_FILE_RULES,
  sample,
  error,
  valid,
  markers,
  onRun,
  extraActions,
  onFileLoaded,
}: {
  field: Field;
  title?: string;
  language?: string;
  rules?: FileRules;
  sample?: string;
  error?: ParseError | null;
  valid?: boolean;
  markers?: readonly EditorMarker[];
  onRun?: () => void;
  extraActions?: ReactNode;
  onFileLoaded?: (fileName: string) => void;
}) {
  const value = useTextWorkspaceStore((s) => s[field]);
  const set = useTextWorkspaceStore((s) => s.set);
  return (
    <JsonInputPanel
      title={title}
      value={value}
      onChange={(v) => {
        set({ [field]: v });
      }}
      language={language}
      rules={rules}
      {...(sample !== undefined ? { sample } : {})}
      {...(error !== undefined ? { error } : {})}
      {...(valid !== undefined ? { valid } : {})}
      {...(markers ? { markers } : {})}
      {...(onRun ? { onRun } : {})}
      {...(extraActions ? { extraActions } : {})}
      {...(onFileLoaded ? { onFileLoaded } : {})}
    />
  );
}
