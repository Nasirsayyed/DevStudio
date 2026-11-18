import { Box, Stack, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { CopyButton } from '@/components';
import { fontFamilies } from '@/theme/tokens';

export interface ResultItem {
  label: string;
  value: string;
  /** Extra content after the value (chips, hints). */
  extra?: ReactNode;
  mono?: boolean;
}

/** Label / value rows, each value copyable. */
export function ResultTable({
  items,
  ariaLabel,
  onCopied,
}: {
  items: readonly ResultItem[];
  ariaLabel: string;
  onCopied?: (item: ResultItem) => void;
}) {
  return (
    <Table size="small" aria-label={ariaLabel}>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.label} sx={{ '&:last-child td': { borderBottom: 0 } }}>
            <TableCell
              component="th"
              scope="row"
              sx={{
                width: { xs: 120, sm: 200 },
                color: 'text.secondary',
                pl: 0,
                verticalAlign: 'top',
                pt: 1.25,
              }}
            >
              {item.label}
            </TableCell>
            <TableCell
              sx={{
                fontFamily: item.mono === false ? undefined : fontFamilies.mono,
                fontSize: 13,
                overflowWrap: 'anywhere',
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Box component="span" sx={{ flex: 1 }}>
                  {item.value}
                </Box>
                {item.extra}
              </Stack>
            </TableCell>
            <TableCell sx={{ width: 48, pr: 0 }} align="right">
              <CopyButton
                value={item.value}
                label={`Copy ${item.label}`}
                onCopied={() => onCopied?.(item)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A single prominent copyable value. */
export function ResultValue({
  label,
  value,
  onCopied,
}: {
  label: string;
  value: string;
  onCopied?: () => void;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          p: 1,
          borderRadius: 1.5,
          bgcolor: 'background.sunken',
          fontFamily: fontFamilies.mono,
          fontSize: 14,
        }}
      >
        <Box component="output" aria-label={label} sx={{ flex: 1, wordBreak: 'break-all' }}>
          {value}
        </Box>
        <CopyButton value={value} label={`Copy ${label}`} onCopied={onCopied} />
      </Stack>
    </Box>
  );
}
