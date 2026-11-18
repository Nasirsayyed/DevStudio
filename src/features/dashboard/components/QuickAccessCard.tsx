import { Box, Button, Grid, Skeleton } from '@mui/material';
import { Edit2, Flash } from 'iconsax-reactjs';
import { useState } from 'react';
import { EmptyState, Kbd, SectionCard, ToolCard, useNotify } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import { saveQuickAccess, useQuickAccessIds } from '@/hooks/useQuickAccess';
import { resolveTools } from '@/tools/toolRegistry';
import { QuickAccessDialog } from './QuickAccessDialog';

export function QuickAccessCard() {
  const ids = useQuickAccessIds();
  const [open, setOpen] = useState(false);
  const notify = useNotify();
  const tools = ids ? resolveTools(ids) : [];

  const onSave = (next: string[]) => {
    saveQuickAccess(next)
      .then(() => {
        setOpen(false);
        notify.success('Quick access updated.');
      })
      .catch((error: unknown) => {
        notify.error(toUserMessage(error));
      });
  };

  return (
    <SectionCard
      id="quick-access"
      title="Quick access"
      subtitle="Alt + 1…9 opens a slot from anywhere"
      action={
        <Button
          size="small"
          startIcon={<Edit2 size={16} color="currentColor" />}
          onClick={() => {
            setOpen(true);
          }}
        >
          Customize
        </Button>
      }
    >
      {ids === undefined ? (
        <Grid container spacing={1.5}>
          {Array.from({ length: 4 }, (_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
              <Skeleton variant="rounded" height={58} />
            </Grid>
          ))}
        </Grid>
      ) : tools.length === 0 ? (
        <EmptyState
          dense
          icon={Flash}
          title="No quick-access tools"
          description="Pick the tools you use most."
        />
      ) : (
        <Grid container spacing={1.5}>
          {tools.map((tool, i) => (
            <Grid
              key={tool.id}
              size={{ xs: 12, sm: 6, md: 4, xl: 3 }}
              sx={{ position: 'relative' }}
            >
              <ToolCard tool={tool} compact />
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  pointerEvents: 'none',
                  display: { xs: 'none', sm: 'block' },
                }}
              >
                <Kbd combo={`alt+${i + 1}`} size="small" />
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
      <QuickAccessDialog
        open={open}
        initial={ids ?? []}
        onClose={() => {
          setOpen(false);
        }}
        onSave={onSave}
      />
    </SectionCard>
  );
}
