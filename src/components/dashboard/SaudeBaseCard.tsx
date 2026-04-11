import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import type { SaudeBase } from '@/hooks/useDashboardMetrics';

interface SaudeBaseCardProps {
  data?: SaudeBase;
  isLoading?: boolean;
}

export function SaudeBaseCard({ data, isLoading }: SaudeBaseCardProps) {
  const total = data?.total ?? 0;
  const ativos = data?.ativos ?? 0;
  const inativos = data?.inativos ?? 0;
  const perdidos = data?.perdidos ?? 0;

  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const pctAtivos = pct(ativos);
  const pctInativos = pct(inativos);
  const pctPerdidos = pct(perdidos);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-600" />
          Saúde da Base
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </>
        ) : (
          <>
            <SaudeRow
              label="Ativos"
              hint="Atualizados nos últimos 30d"
              count={ativos}
              pct={pctAtivos}
              barClass="[&>div]:bg-emerald-500"
            />
            <SaudeRow
              label="Inativos"
              hint="30–90 dias"
              count={inativos}
              pct={pctInativos}
              barClass="[&>div]:bg-amber-500"
            />
            <SaudeRow
              label="Perdidos"
              hint="90+ dias sem atualização"
              count={perdidos}
              pct={pctPerdidos}
              barClass="[&>div]:bg-red-500"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SaudeRow({
  label,
  hint,
  count,
  pct,
  barClass,
}: {
  label: string;
  hint: string;
  count: number;
  pct: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <span className="text-sm tabular-nums">
          <span className="font-semibold">{count}</span>
          <span className="text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <Progress value={pct} className={`h-2 ${barClass}`} />
    </div>
  );
}
