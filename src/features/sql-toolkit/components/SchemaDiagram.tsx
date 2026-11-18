import { useTheme } from '@mui/material';
import { useMemo } from 'react';
import { EChart } from '@/components/charts/EChart';
import type { SchemaDesign } from '@/core/sql/design';

const MAX_LISTED_COLUMNS = 10;

/** Entity-relationship diagram (ECharts graph, force layout). */
export function SchemaDiagram({ design }: { design: SchemaDesign }) {
  const theme = useTheme();
  const t = theme.tokens;
  const option = useMemo(() => {
    const nodes = design.tables.map((table) => {
      const cols = table.columns
        .slice(0, MAX_LISTED_COLUMNS)
        .map((c) => `${c.primaryKey ? '🔑 ' : ''}${c.name}  {type|${c.type.toLowerCase()}}`);
      if (table.columns.length > MAX_LISTED_COLUMNS)
        cols.push(`{type|… ${String(table.columns.length - MAX_LISTED_COLUMNS)} more}`);
      return {
        id: table.id,
        name: table.name || '(unnamed)',
        symbol: 'roundRect',
        symbolSize: [
          Math.max(
            130,
            7 *
              Math.max(
                table.name.length + 2,
                ...table.columns
                  .slice(0, MAX_LISTED_COLUMNS)
                  .map((c) => c.name.length + c.type.length + 4),
              ),
          ),
          30 + 16 * cols.length,
        ],
        itemStyle: { color: t.surfaceRaised, borderColor: t.border, borderWidth: 1 },
        label: {
          show: true,
          formatter: [`{title|${table.name || '(unnamed)'}}`, ...cols].join('\n'),
          rich: {
            title: {
              fontWeight: 'bold',
              fontSize: 13,
              color: t.textPrimary,
              padding: [0, 0, 4, 0],
            },
            type: { color: t.textSecondary, fontSize: 11 },
          },
          color: t.textPrimary,
          fontSize: 12,
          lineHeight: 16,
          align: 'left',
          position: 'insideTopLeft',
          padding: [8, 10],
        },
      };
    });
    const links = design.relations.map((r) => {
      const from = design.tables.find((x) => x.id === r.fromTable);
      const col = from?.columns.find((c) => c.id === r.fromColumn)?.name ?? '';
      return {
        source: r.fromTable,
        target: r.toTable,
        label: { show: true, formatter: col, fontSize: 10, color: t.textSecondary },
        lineStyle: {
          color: t.chart[0],
          width: 1.5,
          curveness: r.fromTable === r.toTable ? 0.6 : 0.15,
        },
      };
    });
    return {
      tooltip: { show: false },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          force: { repulsion: 1200, edgeLength: [200, 300], gravity: 0.15, layoutAnimation: false },
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: 8,
          data: nodes,
          links,
        },
      ],
    };
  }, [design, t]);

  const description = `Diagram of ${String(design.tables.length)} tables: ${design.tables.map((x) => x.name).join(', ')}. ${String(design.relations.length)} relationships.`;
  return <EChart option={option} height="100%" ariaLabel={description} />;
}
