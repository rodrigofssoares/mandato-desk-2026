import { cn } from '@/lib/utils';

export type StatusChipVariant =
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'
  | 'neutral'
  | 'outline';

export type StatusChipTone = 'soft' | 'solid';

export type StatusChipSize = 'sm' | 'md';

interface StatusChipProps {
  children: React.ReactNode;
  /** Variante semântica. Default: 'neutral'. */
  variant?: StatusChipVariant;
  /** Estilo: 'soft' (bg sutil) ou 'solid' (bg forte). Default: 'soft'. */
  tone?: StatusChipTone;
  /** Tamanho. Default: 'sm'. */
  size?: StatusChipSize;
  /** Ícone à esquerda do label (componente, não LucideIcon). */
  icon?: React.ReactNode;
  className?: string;
}

const SOFT_VARIANTS: Record<StatusChipVariant, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/15 text-accent',
  success: 'bg-success-soft text-success-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  info: 'bg-info-soft text-info-soft-foreground',
  danger: 'bg-danger-soft text-danger-soft-foreground',
  neutral: 'bg-muted text-muted-foreground',
  outline: 'border border-border text-foreground bg-card',
};

const SOLID_VARIANTS: Record<StatusChipVariant, string> = {
  primary: 'bg-primary text-primary-foreground',
  accent: 'bg-accent text-accent-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  info: 'bg-info text-info-foreground',
  danger: 'bg-danger text-danger-foreground',
  neutral: 'bg-foreground text-background',
  outline: 'border border-foreground text-foreground bg-card',
};

const SIZE_CLASSES: Record<StatusChipSize, string> = {
  sm: 'text-[0.7rem] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
};

/**
 * Chip/badge semântico padronizado.
 *
 * Substitui chips inline com cores hardcoded:
 *   ❌ <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">Ativo</span>
 *   ✅ <StatusChip variant="success">Ativo</StatusChip>
 *
 * Trocar tema reflete em todos.
 */
export function StatusChip({
  children,
  variant = 'neutral',
  tone = 'soft',
  size = 'sm',
  icon,
  className,
}: StatusChipProps) {
  const variants = tone === 'solid' ? SOLID_VARIANTS : SOFT_VARIANTS;
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full leading-none whitespace-nowrap',
        variants[variant],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
