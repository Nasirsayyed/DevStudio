import { useTheme } from '@mui/material';
import { useMemo } from 'react';
import { EChart } from '@/components/charts/EChart';
import { getTool } from '@/tools/toolRegistry';
import type { ToolUsageEntity } from '@/types/entities';

/** Horizontal bar chart of the most used tools. Lazy-loaded (pulls in ECharts). */
export default function UsageChart({ usage }: { usage: ToolUsageEntity[] }) {
  const theme = useTheme();
  const option = useMemo(() => {
    const rows = [...usage].reverse(); // largest at the top
    return {
      grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: theme.tokens.border } },
        axisLabel: { color: theme.tokens.textMuted },
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => getTool(r.toolId)?.title ?? r.toolId),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: theme.tokens.textSecondary, width: 150, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          name: 'Opens',
          data: rows.map((r) => r.count),
          barMaxWidth: 18,
          itemStyle: { borderRadius: [0, 4, 4, 0], color: theme.tokens.primary },
        },
      ],
    };
  }, [usage, theme]);

  const description = usage
    .map((u) => `${getTool(u.toolId)?.title ?? u.toolId}: ${u.count}`)
    .join(', ');
  return (
    <EChart
      option={option}
      height={Math.max(160, usage.length * 34 + 24)}
      ariaLabel={`Most used tools. ${description}`}
    />
  );
}
