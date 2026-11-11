import { Button, Stack } from '@mui/material';
import { SearchStatus } from 'iconsax-reactjs';
import { Link as RouterLink } from 'react-router';
import { EmptyState, PageContainer } from '@/components';
import { useUiStore } from '@/stores/uiStore';

export default function NotFoundPage() {
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  return (
    <PageContainer>
      <EmptyState
        icon={SearchStatus}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="contained" component={RouterLink} to="/">
              Go to dashboard
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                openCommandPalette();
              }}
            >
              Search tools
            </Button>
          </Stack>
        }
      />
    </PageContainer>
  );
}
