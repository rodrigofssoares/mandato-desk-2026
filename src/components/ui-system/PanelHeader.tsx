import type { LucideIcon } from 'lucide-react';
import { CardHeader } from '@/components/ui/card';
import { IconBubble, type IconBubbleVariant } from './IconBubble';
import { SectionEyebrow } from './SectionEyebrow';
import { cn } from '@/lib/utils';

interface PanelHeaderProps {
  /** Texto pequeno acima do título (uppercase, accent gold). Opcional. */
  eyebrow?: string;
  /** Título principal do painel. */
  title: string;
  /** Subtítulo opcional abaixo do título. Use pra contexto extra. */
  description?: string;
  /** Ícone exibido em bubble arredondado à esquerda. Opcional. */
  icon?: LucideIcon;
  /** Variante semântica do ícone bubble. Default: 'primary'. */
  iconVariant?: IconBubbleVariant;
  /** Conteúdo à direita (ações: select, toggle, botão "Ver todas", etc). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padronizado pra Cards internos do app — painéis aninhados em
 * Settings, sub-cards em listagens, cards de widgets editáveis. É o
 * análogo "card-internal" do PageHeader.
 *
 * Estrutura: ícone bubble (opcional) + eyebrow (opcional) + título display
 * + descrição (opcional) + actions à direita.
 *
 * Por baixo usa o <CardHeader> do shadcn — você o coloca dentro de um
 * <Card> normalmente.
 *
 * @example
 * ```tsx
 * <Card>
 *   <PanelHeader
 *     eyebrow="Configuração"
 *     title="Lista de Funis"
 *     description="Funis ativos no projeto"
 *     icon={KanbanSquare}
 *     iconVariant="primary"
 *     actions={<Button>Novo</Button>}
 *   />
 *   <CardContent>...</CardContent>
 * </Card>
 * ```
 */
export function PanelHeader({
  eyebrow,
  title,
  description,
  icon,
  iconVariant = 'primary',
  actions,
  className,
}: PanelHeaderProps) {
  return (
    <CardHeader className={cn('space-y-0 pb-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {icon && <IconBubble icon={icon} variant={iconVariant} size="md" />}
          <div className="min-w-0 flex-1">
            {eyebrow && <SectionEyebrow className="mb-0.5">{eyebrow}</SectionEyebrow>}
            <h3 className="font-display font-semibold text-base text-foreground leading-tight">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </CardHeader>
  );
}
