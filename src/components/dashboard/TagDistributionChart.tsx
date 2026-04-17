import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTagDistribution } from '@/hooks/useDashboard';
import { ChartViewToggle } from './ChartViewToggle';
import type { ChartViewType } from '@/lib/dashboardLayout';

const FALLBACK_COLORS = [
  '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981',
  '#ef4444', '#ec4899', '#6366f1', '#14b8a6',
];

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--card-foreground))',
};

interface TagDistributionChartProps {
  viewType?: ChartViewType;
  onChangeViewType?: (type: ChartViewType) => void;
}

export function TagDistributionChart({
  viewType = 'bar-vertical',
  onChangeViewType,
}: TagDistributionChartProps) {
  const { data, isLoading } = useTagDistribution();

  const tinted = (data ?? []).map((entry, idx) => ({
    ...entry,
    fill: entry.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
  }));

  const hasData = tinted.length > 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Distribuição por Tag</CardTitle>
        {onChangeViewType && (
          <ChartViewToggle value={viewType} onChange={onChangeViewType} />
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {isLoading ? (
          <Skeleton className="h-full min-h-[220px] w-full" />
        ) : !hasData ? (
          <div className="h-full min-h-[220px] flex items-center justify-center text-muted-foreground">
            Nenhuma tag encontrada
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={220}>
            {viewType === 'pie' ? (
              <PieChart>
                <Pie
                  data={tinted}
                  dataKey="count"
                  nameKey="name"
                  innerRadius="40%"
                  outerRadius="75%"
                  paddingAngle={2}
                >
                  {tinted.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [value, 'Contatos']}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  verticalAlign="bottom"
                  iconType="circle"
                />
              </PieChart>
            ) : viewType === 'bar-horizontal' ? (
              <BarChart
                data={tinted}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [value, 'Contatos']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {tinted.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={tinted} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                <XAxis
                  dataKey="name"
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [value, 'Contatos']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {tinted.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
