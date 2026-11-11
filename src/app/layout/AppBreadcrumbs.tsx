import { Breadcrumbs, Link, Typography, useMediaQuery, useTheme } from '@mui/material';
import { ArrowRight2 } from 'iconsax-reactjs';
import { Link as RouterLink } from 'react-router';
import { useBreadcrumbs } from './useBreadcrumbs';

export function AppBreadcrumbs() {
  const all = useBreadcrumbs();
  const theme = useTheme();
  // On phones only the current page fits next to the top-bar actions.
  const compact = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const crumbs = compact ? all.slice(-1) : all;
  return (
    <Breadcrumbs
      aria-label="Breadcrumb"
      separator={<ArrowRight2 size={12} color="currentColor" />}
      sx={{
        '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' },
        '& .MuiBreadcrumbs-li': { minWidth: 0 },
        minWidth: 0,
        overflow: 'hidden',
        fontSize: 13,
      }}
    >
      {crumbs.map((c, i) =>
        c.to && i < crumbs.length - 1 ? (
          <Link
            key={c.label}
            component={RouterLink}
            to={c.to}
            color="text.secondary"
            noWrap
            sx={{ fontSize: 'inherit' }}
          >
            {c.label}
          </Link>
        ) : (
          <Typography
            key={c.label}
            color="text.primary"
            noWrap
            aria-current="page"
            sx={{ fontSize: 'inherit', fontWeight: 600 }}
          >
            {c.label}
          </Typography>
        ),
      )}
    </Breadcrumbs>
  );
}
