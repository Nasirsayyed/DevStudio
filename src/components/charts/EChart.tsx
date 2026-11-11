import { Box, useTheme } from '@mui/material';
import { useEffect, useRef } from 'react';
import { type EChartsCoreOption, echarts } from './echarts';

export interface EChartProps {
  option: EChartsCoreOption;
  height?: number | string;
  /** Accessible description of what the chart shows. */
  ariaLabel: string;
}

/**
 * Minimal, theme-aware ECharts wrapper. Uses the SVG renderer (crisp, small,
 * CSP-friendly) and resizes with its container.
 */
export function EChart({ option, height = 260, ariaLabel }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const theme = useTheme();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const chart = echarts.init(el, undefined, { renderer: 'svg' });
    chartRef.current = chart;
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => chart.resize()) : null;
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const t = theme.tokens;
    chartRef.current?.setOption(
      {
        color: [...t.chart],
        backgroundColor: 'transparent',
        textStyle: { fontFamily: theme.typography.fontFamily, color: t.textSecondary },
        tooltip: {
          backgroundColor: t.surfaceRaised,
          borderColor: t.border,
          textStyle: { color: t.textPrimary, fontSize: 12 },
        },
        aria: { enabled: true, label: { description: ariaLabel } },
        ...option,
      },
      { notMerge: true },
    );
  }, [option, theme, ariaLabel]);

  return (
    <Box ref={containerRef} role="img" aria-label={ariaLabel} sx={{ width: '100%', height }} />
  );
}
