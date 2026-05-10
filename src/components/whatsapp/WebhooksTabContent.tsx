import { useState } from 'react';
import { Copy, Eye, EyeOff, Lock, Webhook, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui-system';
import { useImpersonation } from '@/context/ImpersonationContext';
import { useZapiWebhookConfigs, type ZapiWebhookConfig } from '@/hooks/useZapiAccounts';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function buildWebhookUrl(accountId: string): string {
  return `${SUPABASE_URL}/functions/v1/zapi-webhook?account=${accountId}`;
}

export function WebhooksTabContent() {
  const { activeRole } = useImpersonation();
  const isAdmin = activeRole === 'admin';
  const { data: configs = [], isLoading } = useZapiWebhookConfigs(isAdmin);

  if (!isAdmin) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <EmptyState
          icon={Lock}
          title="Acesso restrito"
          description="Somente administradores podem visualizar as URLs e segredos dos webhooks Z-API."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <EmptyState
        icon={Webhook}
        title="Nenhuma conta cadastrada"
        description="Cadastre uma conta na aba Contas para ver as configurações de webhook."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Webhook className="h-4 w-4" />
        <AlertDescription className="text-xs space-y-2">
          <p>
            Configure as URLs abaixo no painel Z-API de cada instância (em <strong>Webhook
            ao receber</strong>, <strong>Webhook ao enviar</strong>, <strong>Webhook de status
            de mensagem</strong> e <strong>Webhook de conexão</strong>).
          </p>
          <p>
            O segredo deve ser configurado como header customizado{' '}
            <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">
              X-Webhook-Secret
            </code>{' '}
            no painel Z-API. Sem ele, o webhook é rejeitado.
          </p>
          <a
            href="https://developer.z-api.io/webhooks/introduction"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Documentação Z-API <ExternalLink className="h-3 w-3" />
          </a>
        </AlertDescription>
      </Alert>

      {configs.map((config) => (
        <WebhookCard key={config.id} config={config} />
      ))}
    </div>
  );
}

// ─── Card por conta ─────────────────────────────────────────────────────────

interface WebhookCardProps {
  config: ZapiWebhookConfig;
}

function WebhookCard({ config }: WebhookCardProps) {
  const url = buildWebhookUrl(config.id);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedField, setCopiedField] = useState<'url' | 'secret' | null>(null);

  async function handleCopy(value: string, field: 'url' | 'secret') {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success('Copiado pra área de transferência');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Falha ao copiar — copie manualmente');
    }
  }

  return (
    <div className="border rounded-lg bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 pb-2 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary/15 flex items-center justify-center">
            <Webhook className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{config.name}</p>
            <p className="text-[11px] text-muted-foreground font-mono">{config.id}</p>
          </div>
        </div>
      </div>

      {/* URL */}
      <div className="space-y-1.5">
        <Label className="text-xs">URL do webhook</Label>
        <div className="flex gap-2">
          <Input
            value={url}
            readOnly
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => handleCopy(url, 'url')}
            title="Copiar URL"
          >
            {copiedField === 'url' ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Use a mesma URL nos 4 webhooks Z-API (recebida, enviada, status e conexão).
        </p>
      </div>

      {/* Secret */}
      <div className="space-y-1.5">
        <Label className="text-xs">Segredo (X-Webhook-Secret)</Label>
        <div className="flex gap-2">
          <Input
            value={showSecret ? config.webhook_secret : '••••••••••••••••••••••••••••••••'}
            readOnly
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setShowSecret((v) => !v)}
            title={showSecret ? 'Ocultar' : 'Mostrar'}
          >
            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => handleCopy(config.webhook_secret, 'secret')}
            title="Copiar segredo"
          >
            {copiedField === 'secret' ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Adicione no painel Z-API como header personalizado:{' '}
          <code className="font-mono">X-Webhook-Secret</code>.
        </p>
      </div>
    </div>
  );
}
