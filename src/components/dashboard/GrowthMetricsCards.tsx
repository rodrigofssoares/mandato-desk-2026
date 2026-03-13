import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGrowthMetrics } from '@/hooks/useDashboard';

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (current > previous) {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  if (current < previous) {
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function GrowthMetricsCards() {
  const { data, isLoading } = useGrowthMetrics();

  const metrics = [
    { label: 'Novos Hoje', value: data?.today ?? 0, compare: data?.yesterday ?? 0 },
    { label: 'Novos Ontem', value: data?.yesterday ?? 0, compare: data?.today ?? 0 },
    { label: 'Últimos 7 Dias', value: data?.last7 ?? 0, compare: null },
    { label: 'Este Mês', value: data?.thisMonth ?? 0, compare: data?.lastMonth ?? 0 },
    { label: 'Mês Passado', value: data?.lastMonth ?? 0, compare: null },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {metrics.map((m) => (
        <Card key={m.label}>
          <CardContent className="p-4">
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-12 mb-1" />
                <Skeleton className="h-4 w-20" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{m.value}</p>
                  {m.compare !== null && (
                    <TrendIndicator current={m.value} previous={m.compare} />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
