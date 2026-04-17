import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useVoteStats } from '@/hooks/useDashboard';
import { ChartViewToggle } from './ChartViewToggle';
import type { ChartViewType } from '@/lib/dashboardLayout';

const COLORS = { declared: '#22c55e', notDeclared: '#6b7280' };

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--card-foreground))',
};

interface VoteDeclarationChartProps {
  viewType?: ChartViewType;
  onChangeViewType?: (type: ChartViewType) => void;
}

export function VoteDeclarationChart({
  viewType = 'bar-horizontal',
  onChangeViewType,
}: VoteDeclarationChartProps) {
  const { data, isLoading } = useVoteStats();

  const chartData = data
    ? [
        {
          name: 'Declararam Voto',
          value: data.declared,
          pct: data.total > 0 ? ((data.declared / data.total) * 100).toFixed(1) + '%' : '0%',
          fill: COLORS.declared,
        },
        {
          name: 'Não Declararam',
          value: data.notDeclared,
          pct: data.total > 0 ? ((data.notDeclared / data.total) * 100).toFixed(1) + '%' : '0%',
          fill: COLORS.notDeclared,
        },
      ]
    : [];

  const hasData = chartData.length > 0 && chartData.some((d) => d.value > 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Declaração de Voto</CardTitle>
        {onChangeViewType && (
          <ChartViewToggle value={viewType} onChange={onChangeViewType} />
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {isLoading ? (
          <Skeleton className="h-full min-h-[200px] w-full" />
        ) : !hasData ? (
          <div className="h-full min-h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            {viewType === 'pie' ? (
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="45%"
                  outerRadius="75%"
                  paddingAngle={3}
                  label={(e: any) => `${e.pct}`}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, _name: string, props: any) => [
                    `${value} (${props.payload.pct})`,
                    'Contatos',
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="bottom" iconType="circle" />
              </PieChart>
            ) : viewType === 'bar-vertical' ? (
              <BarChart data={chartData} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis allowDecimals={false} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, _name: string, props: any) => [
                    `${value} (${props.payload.pct})`,
                    'Contatos',
                  ]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="pct" position="top" className="fill-foreground text-sm" />
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={chartData} layout="vertical" barSize={32}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" allowDecimals={false} className="fill-muted-foreground" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fontSize: 13 }}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, _name: string, props: any) => [
                    `${value} (${props.payload.pct})`,
                    'Contatos',
                  ]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="pct" position="right" className="fill-foreground text-sm" />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
