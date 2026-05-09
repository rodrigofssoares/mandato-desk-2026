import { MessageSquare } from 'lucide-react';
import { EmptyState } from '@/components/ui-system';

export function ConversasTabContent() {
  return (
    <div className="flex items-center justify-center min-h-[320px]">
      <EmptyState
        icon={MessageSquare}
        title="Conversas — Em breve"
        description="A visualizacao de conversas com eleitores via WhatsApp estara disponivel em uma proxima versao. Aguardando implementacao da Edge Function de webhook (T02) e da tela de chat (T14/T15)."
      />
    </div>
  );
}
