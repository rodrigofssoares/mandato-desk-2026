import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Webhook as WebhookIcon } from 'lucide-react';
import { useWebhooks } from '@/hooks/useWebhooks';
import type { Webhook } from '@/hooks/useWebhooks';
import { WebhookCard } from '@/components/webhooks/WebhookCard';
import { WebhookDialog } from '@/components/webhooks/WebhookDialog';

export default function Webhooks() {
  const { data: webhooks = [], isLoading } = useWebhooks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);

  const handleNew = () => {
    setEditingWebhook(null);
    setDialogOpen(true);
  };

  const handleEdit = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <WebhookIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Webhooks</h1>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Webhook
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16">
          <WebhookIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Nenhum webhook configurado</h2>
          <p className="text-muted-foreground mb-4">
            Webhooks permitem notificar sistemas externos sobre eventos no CRM.
          </p>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeiro Webhook
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {webhooks.map((webhook) => (
            <WebhookCard key={webhook.id} webhook={webhook} onEdit={handleEdit} />
          ))}
        </div>
      )}

      <WebhookDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        webhook={editingWebhook}
      />
    </div>
  );
}
