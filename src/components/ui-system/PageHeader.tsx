import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconBubble, type IconBubbleVariant } from './IconBubble';
import { SectionEyebrow } from './SectionEyebrow';

interface PageHeaderProps {
  /** Texto pequeno acima do título (uppercase). Categoriza o módulo. */
  eyebrow?: string;
  /** Título principal da página. */
  title: string;
  /** Descrição abaixo do título. Opcional. */
  description?: string;
  /** Ícone bubble à esquerda do título. */
  icon?: LucideIcon;
  /** Variante semântica do ícone. Default: 'primary'. */
  iconVariant?: IconBubbleVariant;
  /** Conteúdo à direita: ações, badges, contadores, botões CTA. */
  actions?: React.ReactNode;
  /** Conteúdo extra ABAIXO do bloco principal — search, filters, tabs. */
  children?: React.ReactNode;
  /** Margem inferior. Default: mb-6. */
  className?: string;
}

/**
 * Cabeçalho padronizado pro topo de cada página do app.
 *
 * Substitui o padrão antigo de cada página inventar seu próprio header
 * com `<h1 className="text-2xl font-bold">Contatos</h1>` — agora todas
 * as páginas chamam `<PageHeader title="Contatos" ... />`.
 *
 * Trocar tema Burgundy↔Navy reflete automaticamente nos eyebrows e
 * ícones (que usam tokens semânticos).
 *
 * @example
 * ```tsx
 * <PageHeader
 *   eyebrow="Operação"
 *   title="Contatos"
 *   description="6.379 contatos cadastrados"
 *   icon={Users}
 *   iconVariant="primary"
 *   actions={
 *     <>
 *       <Button variant="outline" size="sm">Importar</Button>
 *       <Button size="sm">Novo Contato</Button>
 *     </>
 *   }
 * >
 *   {/* Filtros, search, etc *\/}
 * </PageHeader>
 * ```
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  iconVariant = 'primary',
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {icon && <IconBubble icon={icon} variant={iconVariant} size="lg" />}
          <div className="min-w-0 flex-1">
            {eyebrow && <SectionEyebrow className="mb-1.5">{eyebrow}</SectionEyebrow>}
            <h1 className="font-display font-bold text-2xl text-foreground leading-tight">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}
