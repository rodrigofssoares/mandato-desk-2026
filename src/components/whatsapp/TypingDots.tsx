// TypingDots — animação de "digitando..."
// T40 — Fase 4 (Interações nativas do WhatsApp)
//
// 3 pontos animados via CSS puro (sem biblioteca de animação).

import { cn } from '@/lib/utils';

interface TypingDotsProps {
  className?: string;
}

export function TypingDots({ className }: TypingDotsProps) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label="digitando">
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
    </span>
  );
}
