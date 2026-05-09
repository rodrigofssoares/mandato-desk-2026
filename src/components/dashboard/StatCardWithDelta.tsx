import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { IconBubble, type IconBubbleVariant } from '@/components/ui-system/IconBubble';
import { cn } from '@/lib/utils';

interface StatCardWithDeltaProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** Variante semântica do ícone bubble. Default: 'primary'. */
  iconVariant?: IconBubbleVariant;
  /** @deprecated Use `iconVariant`. Mantido pra compat. */
  iconColor?: string;
  /** @deprecated Use `iconVariant`. Mantido pra compat. */
  iconBg?: string;
  /** Variação percentual (null = sem comparação disponível). */
  deltaPct?: number | null;
  /** Linha secundária opcional (ex: "31% taxa", "vs. mês passado"). */
  hint?: string;
  isLoading?: boolean;
  /** Quando definido, exibe progress bar h-1.5 logo após o valor. */
  progressPct?: number | null;
  /** Quando definido, o card vira link clicável apontando pra esta rota. */
  href?: string;
}

export function StatCardWithDelta({
  label,
  value,
  icon,
  iconVariant = 'primary',
  iconColor,
  iconBg,
  deltaPct,
  hint,
  isLoading = false,
  progressPct,
  href,
}: StatCardWithDeltaProps) {
  const deltaDisponivel = deltaPct !== null && deltaPct !== undefined;
  const isPositive = deltaDisponivel && (deltaPct as number) > 0;
  const isNegative = deltaDisponivel && (deltaPct as number) < 0;
  const isZero = deltaDisponivel && (deltaPct as number) === 0;

  const DeltaIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const deltaColor = isPositive
    ? 'text-success'
    : isNegative
    ? 'text-danger'
    : 'text-muted-foreground';

  // Compat: se passou iconColor/iconBg legados, monta className override.
  const legacyOverride = iconColor || iconBg ? cn(iconBg, iconColor) : undefined;

  const card = (
    <Card
      className={cn(
        'transition-shadow hover:shadow-md',
        href && 'cursor-pointer hover:bg-accent/40',
      )}
    >
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
                    'font-bold mt-1 truncate tabular-nums text-foreground',
                    progressPct != null ? 'text-2xl' : 'text-3xl',
                  )}
                >
                  {value}
                </p>
                {progressPct != null && (
                  <div className="mt-2 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        progressPct >= 100 ? 'bg-success' : 'bg-primary',
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
          <IconBubble
            icon={icon}
            variant={iconVariant}
            size="lg"
            className={legacyOverride}
          />
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        to={href}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      >
        {card}
      </Link>
    );
  }

  return card;
}
