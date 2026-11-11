import { List, ListItemButton, ListItemText, Skeleton, Stack, Typography } from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';
import type { Icon } from 'iconsax-reactjs';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { EmptyState, SectionCard } from '@/components';

export interface RecentItem {
  id: string;
  title: string;
  subtitle?: ReactNode;
  timestamp: number;
  to: string;
}

export interface RecentItemsCardProps {
  id: string;
  title: string;
  items: RecentItem[] | undefined;
  emptyIcon: Icon;
  emptyTitle: string;
  emptyDescription: string;
}

export function RecentItemsCard({
  id,
  title,
  items,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: RecentItemsCardProps) {
  return (
    <SectionCard id={id} title={title} flush>
      {items === undefined ? (
        <Stack spacing={1} sx={{ px: 2.5, py: 1 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height={36} />
          ))}
        </Stack>
      ) : items.length === 0 ? (
        <EmptyState dense icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      ) : (
        <List dense disablePadding aria-label={title}>
          {items.map((item) => (
            <li key={item.id}>
              <ListItemButton component={RouterLink} to={item.to} sx={{ mx: 1 }}>
                <ListItemText
                  primary={item.title || 'Untitled'}
                  secondary={item.subtitle}
                  slotProps={{
                    primary: { noWrap: true, sx: { fontSize: 13.5, fontWeight: 550 } },
                    secondary: { noWrap: true, sx: { fontSize: 11.5 } },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 1 }}>
                  {formatDistanceToNowStrict(item.timestamp, { addSuffix: true })}
                </Typography>
              </ListItemButton>
            </li>
          ))}
        </List>
      )}
    </SectionCard>
  );
}
