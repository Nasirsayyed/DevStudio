import { Box, Stack } from '@mui/material';
import type { ReactNode } from 'react';
import { ToolWorkspace } from '@/components';
import { requireTool } from '@/tools/toolRegistry';

/** Scrollable workspace for form-style utilities. */
export function UtilityPage({
  toolId,
  toolbar,
  children,
}: {
  toolId: string;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ToolWorkspace tool={requireTool(toolId)} toolbar={toolbar}>
      <Box
        sx={{
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          mx: { xs: -1.5, sm: -2 },
          px: { xs: 1.5, sm: 2 },
        }}
      >
        <Stack spacing={2} sx={{ maxWidth: 1100, pb: 3 }}>
          {children}
        </Stack>
      </Box>
    </ToolWorkspace>
  );
}
