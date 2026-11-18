import { Box, Card, Collapse, Grid, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { SearchInput, ToolCard } from '@/components';
import { CANONICAL_TOOLS } from '@/tools/toolRegistry';
import { searchTools } from '@/tools/toolSearch';

/** Dashboard hero: greeting + instant search across all tools. */
export function ToolSearchCard({ greeting }: { greeting: string }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => (query.trim() ? searchTools(query, { limit: 6 }) : []), [query]);

  return (
    <Card
      sx={(t) => ({
        p: { xs: 2.5, sm: 3.5 },
        background:
          t.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(34,211,238,0.08) 60%, transparent)'
            : 'linear-gradient(135deg, rgba(79,70,229,0.10), rgba(8,145,178,0.06) 60%, transparent)',
      })}
    >
      <Typography variant="h2" component="h1">
        {greeting}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
        {CANONICAL_TOOLS.length} developer tools, running entirely in your browser.
      </Typography>
      <Box sx={{ maxWidth: 560 }}>
        <SearchInput
          value={query}
          onChange={setQuery}
          debounceMs={0}
          label="Search all tools"
          placeholder="Search all tools…"
          fullWidth
          size="medium"
        />
      </Box>
      <Collapse in={results.length > 0 || query.trim().length > 0} unmountOnExit>
        <Box sx={{ mt: 2 }} aria-live="polite">
          {results.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No tools match “{query}”.
            </Typography>
          ) : (
            <Grid
              container
              spacing={1.5}
              aria-label="Tool search results"
              component="ul"
              sx={{ listStyle: 'none', p: 0, m: 0 }}
            >
              {results.map((tool) => (
                <Grid key={tool.id} size={{ xs: 12, sm: 6, lg: 4 }} component="li">
                  <ToolCard tool={tool} compact />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Collapse>
    </Card>
  );
}
