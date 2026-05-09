import type { LucideIcon } from 'lucide-react';
import { CardHeader } from '@/components/ui/card';
import { IconBubble, type IconBubbleVariant } from '@/components/ui-system/IconBubble';
import { SectionEyebrow } from '@/components/ui-system/SectionEyebrow';
import { cn } from '@/lib/utils';

interface WidgetHeaderProps {
  /** Texto pequeno acima do título (uppercase, accent gold). Opcional. */
  eyebrow?: string;
  /** Título principal do widget. */
  title: string;
  /** Ícone exibido em bubble arredondado à esquerda. Opcional. */
  icon?: LucideIcon;
  /** Variante semântica do ícone bubble. Default: 'primary'. */
  iconVariant?: IconBubbleVariant;
  /**
   * @deprecated Use `iconVariant` ao invés. Mantido só pra compat com
   * código legado que passava classes Tailwind direto.
   */
  iconBubbleClassName?: string;
  /** Conteúdo à direita (ações: select, toggle, botão "Ver todas", etc). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Header padronizado pros widgets do Dashboard, alinhado com os mockups.
 * Usa os primitivos do design system (IconBubble + SectionEyebrow) pra
 * garantir coerência com o resto do app.
 */
export function WidgetHeader({
  eyebrow,
  title,
  icon,
  iconVariant = 'primary',
  iconBubbleClassName,
  actions,
  className,
}: WidgetHeaderProps) {
  return (
    <CardHeader className={cn('space-y-0 pb-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <IconBubble
              icon={icon}
              variant={iconVariant}
              size="md"
              className={iconBubbleClassName}
            />
          )}
          <div className="min-w-0">
            {eyebrow && <SectionEyebrow className="mb-0.5">{eyebrow}</SectionEyebrow>}
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
