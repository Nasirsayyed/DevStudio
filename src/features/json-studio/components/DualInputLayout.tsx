import { Box, useMediaQuery, useTheme } from '@mui/material';
import type { ReactNode } from 'react';
import { SplitPane, ToolWorkspace } from '@/components';
import { requireTool } from '@/tools/toolRegistry';
import { useJsonDocumentFromUrl } from '@/hooks/useJsonDocumentFromUrl';

/** Two inputs side by side on top, results underneath. */
export function DualInputLayout({
  toolId,
  toolbar,
  first,
  second,
  results,
}: {
  toolId: string;
  toolbar?: ReactNode;
  first: ReactNode;
  second: ReactNode;
  results: ReactNode;
}) {
  const tool = requireTool(toolId);
  useJsonDocumentFromUrl();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  return (
    <ToolWorkspace tool={tool} toolbar={toolbar}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          height: desktop ? '100%' : 'auto',
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            flex: desktop ? '0 0 46%' : 'none',
            minHeight: desktop ? 220 : undefined,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <SplitPane storageKey={toolId} first={first} second={second} stackedPaneHeight="45vh" />
        </Box>
        <Box
          sx={{
            flex: 1,
            minHeight: desktop ? 0 : '60vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {results}
        </Box>
      </Box>
    </ToolWorkspace>
  );
}
