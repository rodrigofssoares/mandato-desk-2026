import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Lock, MessageCircle, Send } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui-system';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContasTabContent } from '@/components/whatsapp/ContasTabContent';
import { ConversasTabContent } from '@/components/whatsapp/ConversasTabContent';
import { WebhooksTabContent } from '@/components/whatsapp/WebhooksTabContent';
import { LogsTabContent } from '@/components/whatsapp/LogsTabContent';
import { NewMessageDialog } from '@/components/whatsapp/NewMessageDialog';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import { usePermissions } from '@/hooks/usePermissions';

const TABS = ['contas', 'conversas', 'webhooks', 'logs'] as const;
type Tab = (typeof TABS)[number];

function isValidTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab);
}

export default function Whatsapp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: Tab = isValidTab(rawTab) ? rawTab : 'contas';

  const { can, isLoading: isPermLoading } = usePermissions();
  const canAccess = can.accessWhatsapp();

  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const { data: accounts = [] } = useZapiAccounts();
  const hasSendableAccount = accounts.some((a) => a.status !== 'disconnected');

  function handleTabChange(value: string) {
    setSearchParams({ tab: value }, { replace: true });
  }

  if (isPermLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Lock}
          title="Acesso restrito"
          description="O módulo WhatsApp está disponível apenas para administradores. Solicite acesso a um administrador se precisar usar esta área."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Integrações"
        title="WhatsApp"
        description="Gerencie contas Z-API, acompanhe conversas com eleitores e monitore webhooks."
        icon={MessageCircle}
        iconVariant="success"
        actions={
          <Button
            onClick={() => setNewMessageOpen(true)}
            disabled={!hasSendableAccount}
            title={
              hasSendableAccount
                ? 'Enviar mensagem direto, sem abrir conversa'
                : 'Cadastre uma conta Z-API antes de enviar mensagens'
            }
          >
            <Send className="h-4 w-4 mr-2" />
            Nova mensagem
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="conversas">Conversas</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="space-y-4">
          <ContasTabContent />
        </TabsContent>

        <TabsContent value="conversas">
          <ConversasTabContent />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhooksTabContent />
        </TabsContent>

        <TabsContent value="logs">
          <LogsTabContent />
        </TabsContent>
      </Tabs>

      <NewMessageDialog open={newMessageOpen} onOpenChange={setNewMessageOpen} />
    </div>
  );
}
