import { Alert } from '@mui/material';
import type { SanitizeReport } from '@/services/html/sanitize';

/** Tells the user what the sanitizer removed or blocked (nothing is shown when nothing was). */
export function SanitizerNotice({ report }: { report: SanitizeReport }) {
  const removed = Object.entries(report.removed);
  if (removed.length === 0 && report.blockedResources === 0) return null;
  const parts = removed.map(([what, n]) => (n > 1 ? `${what} ×${String(n)}` : what));
  return (
    <Alert severity="info" variant="outlined" sx={{ m: 1.5, mb: 0, borderRadius: 2 }}>
      {parts.length > 0 && <>Removed for safety: {parts.join(', ')}. </>}
      {report.blockedResources > 0 && (
        <>
          {report.blockedResources} external{' '}
          {report.blockedResources === 1 ? 'resource was' : 'resources were'} blocked (the preview
          never contacts other servers).
        </>
      )}
    </Alert>
  );
}
