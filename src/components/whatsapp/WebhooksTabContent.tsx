import { Webhook } from 'lucide-react';
import { EmptyState } from '@/components/ui-system';

export function WebhooksTabContent() {
  return (
    <div className="flex items-center justify-center min-h-[320px]">
      <EmptyState
        icon={Webhook}
        title="Webhooks — Em breve"
        description="A configuracao de webhooks Z-API e a visualizacao de URLs e secrets por conta estara disponivel em uma proxima versao (T12)."
      />
    </div>
  );
}
