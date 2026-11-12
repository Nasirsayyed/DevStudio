import { Chip, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { SearchInput } from '@/components';
import { DataGrid } from '@/components/data-display/DataGrid';
import { allMimeTypes, type MimeEntry, mimeForFileName, searchMimeTypes } from '@/core/mime/mime';
import { UtilityPage } from '../components/UtilityPage';

export default function MimePage() {
  const [query, setQuery] = useState('');
  const results = searchMimeTypes(query, 2000);
  const direct = query.includes('.') && !query.includes('/') ? mimeForFileName(query.trim()) : null;
  return (
    <UtilityPage toolId="utils.mime">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={1.5}>
          <SearchInput
            value={query}
            onChange={setQuery}
            label="Search by extension, file name or type"
            placeholder="png, report.pdf, application/json, video/…"
            fullWidth
            size="medium"
          />
          <Typography variant="body2" color="text.secondary" aria-live="polite">
            {direct ? (
              <>
                <strong>{query.trim()}</strong> → <code>{direct}</code>
              </>
            ) : (
              `${results.length.toLocaleString()} of ${allMimeTypes().length.toLocaleString()} types`
            )}
          </Typography>
        </Stack>
      </Paper>
      <DataGrid<MimeEntry>
        ariaLabel="MIME types"
        rows={results}
        rowKey={(e) => e.type}
        height={520}
        emptyMessage="No matching MIME types."
        columns={[
          { id: 'type', header: 'MIME type', getValue: (e) => e.type, mono: true },
          {
            id: 'ext',
            header: 'Extensions',
            getValue: (e) => e.extensions.map((x) => `.${x}`).join(' '),
            mono: true,
          },
          {
            id: 'std',
            header: 'Registry',
            width: 140,
            getValue: (e) => (e.standard ? 'IANA' : 'Vendor / other'),
            render: (e) => (
              <Chip
                size="small"
                variant="outlined"
                color={e.standard ? 'primary' : 'default'}
                label={e.standard ? 'IANA' : 'Vendor / other'}
              />
            ),
          },
        ]}
      />
    </UtilityPage>
  );
}
