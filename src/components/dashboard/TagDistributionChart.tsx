import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTagDistribution } from '@/hooks/useDashboard';

const FALLBACK_COLORS = [
  '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981',
  '#ef4444', '#ec4899', '#6366f1', '#14b8a6',
];

export function TagDistributionChart() {
  const { data, isLoading } = useTagDistribution();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Distribuição por Tag</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhuma tag encontrada
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
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
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--card-foreground))',
                }}
                formatter={(value: number) => [value, 'Contatos']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry, idx) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
