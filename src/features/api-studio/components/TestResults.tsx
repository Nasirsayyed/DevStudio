import {
  Alert,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { CloseCircle, TickCircle } from 'iconsax-reactjs';
import type { AssertionResult, ExtractionResult } from '@/core/http/assertions';
import { fontFamilies } from '@/theme/tokens';

/** Assertion outcomes and extracted variables of one response. */
export function TestResults({
  tests,
  extracted,
  label = 'Assertion results',
}: {
  tests: readonly AssertionResult[];
  extracted: ExtractionResult | null;
  label?: string;
}) {
  const passed = tests.filter((t) => t.passed).length;
  return (
    <Stack spacing={1.5} sx={{ p: 1.5, overflow: 'auto' }}>
      {tests.length > 0 && (
        <Box>
          <Typography variant="subtitle2" component="h3">
            {passed} of {tests.length} assertions passed
          </Typography>
          <List dense aria-label={label} disablePadding>
            {tests.map((t) => (
              <ListItem key={t.id} disableGutters sx={{ alignItems: 'flex-start' }}>
                <ListItemIcon
                  sx={{ minWidth: 28, mt: 0.5, color: t.passed ? 'success.main' : 'error.main' }}
                >
                  {t.passed ? (
                    <TickCircle size={18} color="currentColor" variant="Bold" />
                  ) : (
                    <CloseCircle size={18} color="currentColor" variant="Bold" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={`${t.passed ? 'Passed' : 'Failed'}: ${t.label}`}
                  secondary={t.detail}
                  slotProps={{
                    primary: { variant: 'body2' },
                    secondary: { sx: { fontFamily: fontFamilies.mono, overflowWrap: 'anywhere' } },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
      {extracted && (
        <Box>
          <Typography variant="subtitle2" component="h3">
            Extracted variables
          </Typography>
          {Object.keys(extracted.values).length > 0 ? (
            <Box
              component="dl"
              aria-label="Extracted variables"
              sx={{
                m: 0,
                display: 'grid',
                gridTemplateColumns: 'max-content 1fr',
                columnGap: 2,
                rowGap: 0.5,
                fontFamily: fontFamilies.mono,
                fontSize: 13,
              }}
            >
              {Object.entries(extracted.values).map(([k, v]) => (
                <Box key={k} sx={{ display: 'contents' }}>
                  <Box component="dt" sx={{ fontWeight: 600 }}>{`{{${k}}}`}</Box>
                  <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                    {v.length > 300 ? `${v.slice(0, 300)}…` : v}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nothing was extracted.
            </Typography>
          )}
          {extracted.errors.map((e) => (
            <Alert key={e} severity="warning" sx={{ mt: 0.5, py: 0 }}>
              {e}
            </Alert>
          ))}
        </Box>
      )}
    </Stack>
  );
}
