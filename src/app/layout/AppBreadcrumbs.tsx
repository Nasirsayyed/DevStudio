import { Breadcrumbs, Link, Typography } from '@mui/material';
import { ArrowRight2 } from 'iconsax-reactjs';
import { Link as RouterLink } from 'react-router';
import { useBreadcrumbs } from './useBreadcrumbs';

export function AppBreadcrumbs() {
  const crumbs = useBreadcrumbs();
  return (
    <Breadcrumbs
      aria-label="Breadcrumb"
      separator={<ArrowRight2 size={12} color="currentColor" />}
      sx={{ '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' }, minWidth: 0, fontSize: 13 }}
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
