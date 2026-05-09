import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGrowthChartData } from '@/hooks/useDashboard';
import { WidgetHeader } from './WidgetHeader';

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  color: 'hsl(var(--card-foreground))',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

export function GrowthChart() {
  const { data, isLoading } = useGrowthChartData();

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <WidgetHeader
        eyebrow="Últimos 30 dias"
        title="Crescimento da Base"
        icon={TrendingUp}
        iconBubbleClassName="bg-primary/10 text-primary"
      />
      <CardContent className="flex-1 min-h-0 pb-4">
        {isLoading ? (
          <Skeleton className="h-full min-h-[200px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="h-full min-h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }}
                labelFormatter={(label) => `Data: ${label}`}
                formatter={(value: number) => [value, 'Contatos']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#growthGradient)"
                activeDot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
