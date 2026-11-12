import { Box, Stack, useMediaQuery, useTheme } from '@mui/material';
import type { ReactNode } from 'react';
import { SplitPane, ToolWorkspace } from '@/components';
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

/** Two inputs side by side on top, the comparison below (stacked on small screens). */
export function CompareLayout({
  toolId,
  toolbar,
  actions,
  left,
  right,
  result,
}: {
  toolId: string;
  toolbar?: ReactNode;
  actions?: ReactNode;
  left: ReactNode;
  right: ReactNode;
  result: ReactNode;
}) {
  useTextDraft();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  return (
    <ToolWorkspace tool={requireTool(toolId)} toolbar={toolbar} actions={actions}>
      <Stack
        spacing={1.5}
        sx={{ flex: 1, minHeight: 0, p: { xs: 1.5, sm: 2 }, pt: { xs: 1.5, sm: 1.5 } }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: desktop ? '1fr 1fr' : '1fr',
            gap: 1.5,
            height: desktop ? '38%' : 'auto',
            minHeight: desktop ? 200 : 0,
            '& > *': { minHeight: desktop ? 0 : 260, display: 'flex' },
          }}
        >
          <Box>{left}</Box>
          <Box>{right}</Box>
        </Box>
        <Box sx={{ flex: 1, minHeight: desktop ? 0 : 480, display: 'flex' }}>{result}</Box>
      </Stack>
    </ToolWorkspace>
  );
}
