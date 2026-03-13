import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, ScrollText } from 'lucide-react';
import type { Webhook } from '@/hooks/useWebhooks';
import { useUpdateWebhook, useDeleteWebhook } from '@/hooks/useWebhooks';
import { WebhookLogs } from './WebhookLogs';

interface WebhookCardProps {
  webhook: Webhook;
  onEdit: (webhook: Webhook) => void;
}

export function WebhookCard({ webhook, onEdit }: WebhookCardProps) {
  const [showLogs, setShowLogs] = useState(false);
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const handleToggle = (checked: boolean) => {
    updateWebhook.mutate({ id: webhook.id, is_active: checked });
  };

  const handleDelete = () => {
    if (!confirm(`Tem certeza que deseja excluir o webhook "${webhook.name}"?`)) return;
    deleteWebhook.mutate(webhook.id);
  };

  const lastLog = webhook.webhook_logs?.[0];
  const lastLogSuccess = lastLog ? (lastLog.status_code ?? 0) >= 200 && (lastLog.status_code ?? 0) < 300 : null;

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {lastLogSuccess !== null && (
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    lastLogSuccess ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{webhook.name}</p>
                <p className="text-xs text-muted-foreground truncate">{webhook.url}</p>
              </div>
            </div>
            <Switch checked={webhook.is_active} onCheckedChange={handleToggle} />
          </div>

          <div className="flex flex-wrap gap-1">
            {webhook.events.map((event) => (
              <Badge key={event} variant="secondary" className="text-[10px]">
                {event}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(webhook)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Editar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowLogs(true)}>
              <ScrollText className="h-3.5 w-3.5 mr-1" />
              Logs
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Excluir
            </Button>
          </div>
        </CardContent>
      </Card>

      <WebhookLogs
        webhookId={showLogs ? webhook.id : undefined}
        webhookName={webhook.name}
        open={showLogs}
        onOpenChange={setShowLogs}
      />
    </>
  );
}
