import { ScrollText } from 'lucide-react';
import { EmptyState } from '@/components/ui-system';

export function LogsTabContent() {
  return (
    <div className="flex items-center justify-center min-h-[320px]">
      <EmptyState
        icon={ScrollText}
        title="Logs — Em breve"
        description="O painel de logs de webhook Z-API com filtros por conta e tipo de evento estara disponivel em uma proxima versao (T14)."
      />
    </div>
  );
}
