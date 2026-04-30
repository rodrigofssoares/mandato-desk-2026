import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardWithDeltaProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  /** Variação percentual (null = sem comparação disponível). */
  deltaPct?: number | null;
  /** Linha secundária opcional (ex: "31% taxa", "vs. mês passado"). */
  hint?: string;
  isLoading?: boolean;
  /** Quando definido, exibe progress bar h-1.5 logo após o valor. */
  progressPct?: number | null;
}

export function StatCardWithDelta({
  label,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  iconBg = 'bg-primary/10',
  deltaPct,
  hint,
  isLoading = false,
  progressPct,
}: StatCardWithDeltaProps) {
  const deltaDisponivel = deltaPct !== null && deltaPct !== undefined;
  const isPositive = deltaDisponivel && (deltaPct as number) > 0;
  const isNegative = deltaDisponivel && (deltaPct as number) < 0;
  const isZero = deltaDisponivel && (deltaPct as number) === 0;

  const deltaIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const DeltaIcon = deltaIcon;
  const deltaColor = isPositive
    ? 'text-green-600 dark:text-green-500'
    : isNegative
    ? 'text-red-600 dark:text-red-500'
    : 'text-muted-foreground';

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-16" />
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {label}
                </p>
                <p
                  className={cn(
                    'font-bold mt-1 truncate tabular-nums',
                    progressPct != null ? 'text-2xl' : 'text-3xl'
                  )}
                >
                  {value}
                </p>
                {progressPct != null && (
                  <div className="mt-2 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        progressPct >= 100 ? 'bg-green-500' : 'bg-primary'
                      )}
                      style={{ width: `${Math.min(Math.max(progressPct, 0), 100)}%` }}
                    />
                  </div>
                )}
                <div className="mt-2 flex items-center gap-1 text-xs">
                  {deltaDisponivel && !isZero && (
                    <>
                      <DeltaIcon className={cn('h-3.5 w-3.5', deltaColor)} />
                      <span className={cn('font-medium', deltaColor)}>
                        {isPositive ? '+' : ''}
                        {(deltaPct as number).toFixed(1)}%
                      </span>
                    </>
                  )}
                  {hint && (
                    <span className="text-muted-foreground">
                      {deltaDisponivel && !isZero ? ` · ${hint}` : hint}
                    </span>
                  )}
                  {!hint && deltaDisponivel && !isZero && (
                    <span className="text-muted-foreground"> · vs. anterior</span>
                  )}
                  {isZero && !hint && (
                    <span className="text-muted-foreground">sem variação</span>
                  )}
                </div>
              </>
            )}
          </div>
          <div
            className={cn(
              'flex items-center justify-center h-11 w-11 rounded-lg shrink-0',
              iconBg
            )}
          >
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
