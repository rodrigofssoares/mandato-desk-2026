import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type IconBubbleSize = 'sm' | 'md' | 'lg';

export type IconBubbleVariant =
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'
  | 'neutral';

interface IconBubbleProps {
  icon: LucideIcon;
  /** Tamanho do bubble. Default: 'md' (36×36). */
  size?: IconBubbleSize;
  /** Variante semântica de cor. Default: 'primary'. */
  variant?: IconBubbleVariant;
  /** Classes extras (override pontual; prefira usar `variant`). */
  className?: string;
}

const SIZE_CLASSES: Record<IconBubbleSize, string> = {
  sm: 'h-7 w-7 rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5',
  md: 'h-9 w-9 rounded-xl [&>svg]:h-4 [&>svg]:w-4',
  lg: 'h-11 w-11 rounded-2xl [&>svg]:h-5 [&>svg]:w-5',
};

const VARIANT_CLASSES: Record<IconBubbleVariant, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/15 text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-muted text-muted-foreground',
};

/**
 * Bubble arredondado com ícone — primitivo do design system.
 * Use sempre que precisar de um ícone com fundo colorido sutil
 * (ao lado de títulos, em métricas, em empty states).
 */
export function IconBubble({
  icon: Icon,
  size = 'md',
  variant = 'primary',
  className,
}: IconBubbleProps) {
  return (
    <div
      className={cn(
        'grid place-items-center shrink-0',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      <Icon />
    </div>
  );
}
