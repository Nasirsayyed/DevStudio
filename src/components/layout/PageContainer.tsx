import { Box } from '@mui/material';
import type { SystemStyleObject, Theme } from '@mui/system';
import type { ReactNode } from 'react';
import { layout } from '@/theme/tokens';

export interface PageContainerProps {
  children: ReactNode;
  /** Style overrides merged over the default page padding and width. */
  sx?: SystemStyleObject<Theme>;
}

export function PageContainer({ children, sx }: PageContainerProps) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: layout.contentMaxWidth,
        mx: 'auto',
        px: { xs: 2, sm: 3, lg: 4 },
        py: { xs: 2, sm: 3 },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
