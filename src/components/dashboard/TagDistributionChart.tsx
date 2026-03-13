import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={90}
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
                labelLine={false}
              >
                {data.map((entry, idx) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--card-foreground))',
                }}
                formatter={(value: number) => [value, 'Contatos']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
