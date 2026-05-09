import { cn } from '@/lib/utils';

export type SectionEyebrowTone =
  | 'accent'
  | 'muted'
  | 'primary'
  | 'success'
  | 'warning'
  | 'info'
  | 'danger';

interface SectionEyebrowProps {
  children: React.ReactNode;
  /** Cor do texto. Default: 'accent' (gold institucional). */
  tone?: SectionEyebrowTone;
  className?: string;
}

const TONES: Record<SectionEyebrowTone, string> = {
  accent: 'text-accent',
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  danger: 'text-danger',
};

/**
 * Texto pequeno em uppercase com tracking largo, usado acima de títulos
 * pra dar contexto/categoria. Padrão visual dos mockups.
 *
 * Ex: "Visão Geral · Maio 2026", "Funil de Conversão", "Distribuição".
 */
export function SectionEyebrow({
  children,
  tone = 'accent',
  className,
}: SectionEyebrowProps) {
  return (
    <p
      className={cn(
        'text-[0.62rem] font-bold uppercase tracking-widest leading-tight',
        TONES[tone],
        className,
      )}
    >
      {children}
    </p>
  );
}
