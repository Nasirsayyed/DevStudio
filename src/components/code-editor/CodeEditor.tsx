import { Box, Skeleton } from '@mui/material';
import { Suspense, lazy } from 'react';
import type { CodeEditorProps, DiffEditorProps } from './types';

// Monaco (~3 MB) is only downloaded when an editor is first rendered.
const MonacoCodeEditor = lazy(() => import('./MonacoCodeEditor'));
const MonacoDiffEditor = lazy(() => import('./MonacoDiffEditor'));

function EditorSkeleton({ height }: { height: number | string }) {
  return (
    <Box sx={{ height, p: 1.5 }} role="status" aria-label="Loading editor">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} width={`${40 + ((i * 37) % 50)}%`} height={18} />
      ))}
    </Box>
  );
}

/** Code editor (Monaco), lazy-loaded with a skeleton placeholder. */
export function CodeEditor(props: CodeEditorProps) {
  return (
    <Suspense fallback={<EditorSkeleton height={props.height ?? '100%'} />}>
      <MonacoCodeEditor {...props} />
    </Suspense>
  );
}

/** Side-by-side / inline diff viewer (Monaco). */
export function DiffEditor(props: DiffEditorProps) {
  return (
    <Suspense fallback={<EditorSkeleton height={props.height ?? '100%'} />}>
      <MonacoDiffEditor {...props} />
    </Suspense>
  );
}
