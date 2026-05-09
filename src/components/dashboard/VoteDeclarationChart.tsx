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
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useVoteStats } from '@/hooks/useDashboard';
import { ChartViewToggle } from './ChartViewToggle';
import { WidgetHeader } from './WidgetHeader';
import type { ChartViewType } from '@/lib/dashboardLayout';

const COLORS = { declared: '#22c55e', notDeclared: '#94a3b8' };

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  color: 'hsl(var(--card-foreground))',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
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
    <Card className="h-full flex flex-col overflow-hidden">
      <WidgetHeader
        eyebrow="Distribuição"
        title="Declaração de Voto"
        icon={CheckCircle2}
        iconBubbleClassName="bg-emerald-500/10 text-emerald-600"
        actions={
          onChangeViewType ? (
            <ChartViewToggle value={viewType} onChange={onChangeViewType} />
          ) : undefined
        }
      />
      <CardContent className="flex-1 min-h-0 pb-4">
        {isLoading ? (
          <Skeleton className="h-full min-h-[200px] w-full" />
        ) : !hasData ? (
          <div className="h-full min-h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            {viewType === 'pie' ? (
              <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="45%"
                  outerRadius="75%"
                  paddingAngle={3}
                  label={(e: { pct: string }) => `${e.pct}`}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, _name: string, props: { payload: { pct: string } }) => [
                    `${value} (${props.payload.pct})`,
                    'Contatos',
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="bottom" iconType="circle" />
              </PieChart>
            ) : viewType === 'bar-vertical' ? (
              // margin top=28 pra acomodar o LabelList "99.9%" SEM cortar.
              <BarChart data={chartData} barSize={48} margin={{ top: 28, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis allowDecimals={false} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                  formatter={(value: number, _name: string, props: { payload: { pct: string } }) => [
                    `${value} (${props.payload.pct})`,
                    'Contatos',
                  ]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="pct" position="top" className="fill-foreground text-sm font-semibold" />
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={chartData} layout="vertical" barSize={32} margin={{ top: 8, right: 56, left: 0, bottom: 4 }}>
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
                  cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                  formatter={(value: number, _name: string, props: { payload: { pct: string } }) => [
                    `${value} (${props.payload.pct})`,
                    'Contatos',
                  ]}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="pct" position="right" className="fill-foreground text-sm font-semibold" />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
