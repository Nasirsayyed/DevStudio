import { Chip } from '@mui/material';
import { useMemo } from 'react';
import { formatBytes } from '@/core/format/bytes';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { TransformLayout } from '../components/TransformLayout';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

export default function JsonMinifierPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const payload = useMemo(() => (input.trim() ? { text: input } : null), [input]);
  return (
    <TransformLayout
      toolId="json.minifier"
      op="minify"
      payload={payload}
      getOutput={(r) => r}
      outputFilename="minified.json"
      sample={SAMPLE_ORDER_JSON}
      outputMeta={(r) => {
        const saved = input.length - r.length;
        const pct = input.length ? Math.round((saved / input.length) * 100) : 0;
        return (
          <Chip
            size="small"
            color="success"
            variant="outlined"
            label={`−${formatBytes(Math.max(0, saved))} (${pct}%)`}
            sx={{ height: 20, fontSize: 11 }}
          />
        );
      }}
    />
  );
}
