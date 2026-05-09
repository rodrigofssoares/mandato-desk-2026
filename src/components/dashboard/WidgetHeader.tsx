import type { LucideIcon } from 'lucide-react';
import { CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WidgetHeaderProps {
  /**
   * Texto pequeno acima do título (uppercase, accent gold). Use pra
   * categorizar ou indicar período/status. Opcional.
   */
  eyebrow?: string;
  /** Título principal do widget. */
  title: string;
  /** Ícone exibido em "bubble" arredondado à esquerda. Opcional. */
  icon?: LucideIcon;
  /** Override visual do bubble do ícone (cor de fundo / cor do ícone). */
  iconBubbleClassName?: string;
  /** Conteúdo à direita (ações: select, toggle, botão "Ver todas", etc). */
  actions?: React.ReactNode;
  /** Classes extras pro CardHeader externo. */
  className?: string;
}

/**
 * Header padronizado pros widgets do Dashboard, alinhado com os mockups
 * (V2/V4) — eyebrow uppercase, título display semibold e ícone em bubble
 * arredondado opcional. Os widgets continuam usando Card/CardContent do
 * shadcn por baixo; só o cabeçalho é compartilhado.
 */
export function WidgetHeader({
  eyebrow,
  title,
  icon: Icon,
  iconBubbleClassName,
  actions,
  className,
}: WidgetHeaderProps) {
  return (
    <CardHeader className={cn('space-y-0 pb-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div
              className={cn(
                'w-9 h-9 rounded-xl bg-primary/10 grid place-items-center text-primary shrink-0',
                iconBubbleClassName,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[0.62rem] font-bold uppercase tracking-widest text-accent leading-tight mb-0.5">
                {eyebrow}
              </p>
            )}
            <h3 className="font-display font-semibold text-base text-foreground leading-tight truncate">
              {title}
            </h3>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </CardHeader>
  );
}
