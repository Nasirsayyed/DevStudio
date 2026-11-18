import { Box } from '@mui/material';

/**
 * Renders sanitized HTML in a sandboxed iframe: no scripts, no same-origin access, no forms.
 * Links may open in a new tab (without referrer). The document has its own CSP as well.
 */
export function PreviewFrame({
  doc,
  title,
  width = '100%',
}: {
  doc: string;
  title: string;
  width?: number | string;
}) {
  const fixed = width !== '100%';
  // A fixed viewport keeps its width (the panel scrolls); auto margins center it without
  // cutting off its left edge when it is wider than the panel.
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        bgcolor: 'background.sunken',
        p: fixed ? 1.5 : 0,
      }}
    >
      <Box
        component="iframe"
        title={title}
        srcDoc={doc}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        sx={{
          display: 'block',
          mx: 'auto',
          border: 0,
          width,
          height: fixed ? 'calc(100% - 4px)' : '100%',
          minHeight: 300,
          bgcolor: 'background.paper',
          boxShadow: fixed ? 3 : 'none',
        }}
      />
    </Box>
  );
}
