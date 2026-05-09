import { Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import type { SaudeBase } from '@/hooks/useDashboardMetrics';
import { WidgetHeader } from './WidgetHeader';

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

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <WidgetHeader
        eyebrow="Diagnóstico"
        title="Saúde da Base"
        icon={Activity}
        iconBubbleClassName="bg-emerald-500/10 text-emerald-600"
      />
      <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4">
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
              pct={pct(ativos)}
              barClass="[&>div]:bg-emerald-500"
            />
            <SaudeRow
              label="Inativos"
              hint="30–90 dias"
              count={inativos}
              pct={pct(inativos)}
              barClass="[&>div]:bg-amber-500"
            />
            <SaudeRow
              label="Perdidos"
              hint="90+ dias sem atualização"
              count={perdidos}
              pct={pct(perdidos)}
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
      <div className="flex items-baseline justify-between mb-1.5 gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-muted-foreground truncate">{hint}</span>
        </div>
        <span className="text-sm tabular-nums shrink-0">
          <span className="font-semibold">{count}</span>
          <span className="text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <Progress value={pct} className={`h-2 ${barClass}`} />
    </div>
  );
}
