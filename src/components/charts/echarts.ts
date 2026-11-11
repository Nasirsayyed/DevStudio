/**
 * Tree-shaken ECharts registration. Only the chart types and components
 * actually used are bundled. Add new ones here as modules need them.
 */
import { BarChart, GraphChart, LineChart, PieChart } from 'echarts/charts';
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GraphChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  SVGRenderer,
]);

export { echarts };
export type { EChartsCoreOption } from 'echarts/core';
