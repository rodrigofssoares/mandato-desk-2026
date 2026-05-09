import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconBubble, type IconBubbleVariant } from './IconBubble';

interface EmptyStateProps {
  /** Ícone exibido em bubble grande no topo. */
  icon: LucideIcon;
  /** Variante do ícone. Default: 'neutral'. */
  iconVariant?: IconBubbleVariant;
  /** Título principal (curto, declarativo). */
  title: string;
  /** Descrição opcional explicando o porquê / próxima ação. */
  description?: string;
  /** CTA opcional (botões, links). */
  action?: React.ReactNode;
  /** Densidade. 'compact' = paddings menores (uso em widgets). */
  density?: 'comfortable' | 'compact';
  className?: string;
}

/**
 * Empty state padronizado — substitui estados vazios criados ad-hoc em
 * cada lista/grid do app.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={Users}
 *   title="Nenhum contato encontrado"
 *   description="Tente ajustar os filtros ou adicione seu primeiro contato."
 *   action={<Button onClick={openCreate}>Novo contato</Button>}
 * />
 * ```
 */
export function EmptyState({
  icon,
  iconVariant = 'neutral',
  title,
  description,
  action,
  density = 'comfortable',
  className,
}: EmptyStateProps) {
  const padding = density === 'compact' ? 'py-8 px-4' : 'py-12 px-6';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3',
        padding,
        className,
      )}
    >
      <IconBubble icon={icon} variant={iconVariant} size="lg" />
      <div>
        <h3 className="font-display font-semibold text-base text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
