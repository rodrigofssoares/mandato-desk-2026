/**
 * WhatsAppFilterLegend.tsx
 *
 * Rodapé de legenda exibido abaixo do BoardKanban quando o filtro de aceite
 * WhatsApp está ativo (mode !== 'all').
 *
 * Itens da legenda:
 * - Ponto verde: "Aceita WhatsApp"
 * - Ponto vermelho: "Não aceita"
 * - Ponto amarelo: "Etapa protegida (filtro não se aplica)"
 * - Texto italic explicativo
 *
 * Renderiza null quando mode === 'all'.
 */

import type { WhatsAppFilterMode } from '@/lib/boardFilterStorage';

interface WhatsAppFilterLegendProps {
  mode: WhatsAppFilterMode;
}

export function WhatsAppFilterLegend({ mode }: WhatsAppFilterLegendProps) {
  if (mode === 'all') return null;

  return (
    <div className="mt-2 px-1 py-2.5 rounded-lg border border-border/50 bg-muted/30 flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full bg-green-600 flex-shrink-0"
          aria-hidden="true"
        />
        <span>Aceita WhatsApp</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0"
          aria-hidden="true"
        />
        <span>Não aceita</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full bg-amber-100 border border-amber-300 flex-shrink-0"
          aria-hidden="true"
        />
        <span>Etapa protegida (filtro não se aplica)</span>
      </div>

      <p className="ml-auto italic text-[11px] text-muted-foreground/80">
        Etapas antes do ponto escolhido mostram todos os contatos — novos leads não ficam ocultos.
      </p>
    </div>
  );
}
