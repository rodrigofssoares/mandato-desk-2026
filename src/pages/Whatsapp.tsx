import { useState, useEffect } from 'react';
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
import { BroadcastsTabContent } from '@/components/whatsapp/BroadcastsTabContent';
import { EventosTabContent } from '@/components/whatsapp/EventosTabContent';
import { DashboardAtendimentoTab } from '@/components/whatsapp/DashboardAtendimentoTab';
import { AuditLogTab } from '@/components/whatsapp/AuditLogTab';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import { usePermissions } from '@/hooks/usePermissions';
import { useImpersonation } from '@/context/ImpersonationContext';
import { isFeatureEnabled } from '@/lib/featureFlags';

// T65 (Fase 6 Onda A): aba de campanhas visível se ao menos 1 conta tem c17 ativo
// T70 (Fase 6 Onda B): aba de eventos visível se ao menos 1 conta tem c20 ativo
// T90 (Fase 7 Onda B): aba de dashboard de atendimento — visível para admins com contas
// T91 (Fase 7 Onda B): aba de auditoria — visível somente para admins
const TABS = ['contas', 'conversas', 'campanhas', 'eventos', 'dashboard', 'auditoria', 'webhooks', 'logs'] as const;
type Tab = (typeof TABS)[number];

function isValidTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab);
}

export default function Whatsapp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  // T15: se ?chat= ou ?contact= presente e tab inválida/ausente, força aba conversas
  const chatParam = searchParams.get('chat');
  const contactParam = searchParams.get('contact');
  const hasDeepLink = !!(chatParam || contactParam);
  const activeTab: Tab = isValidTab(rawTab)
    ? rawTab
    : hasDeepLink
      ? 'conversas'
      : 'contas';

  const { can, isLoading: isPermLoading } = usePermissions();
  const canAccess = can.accessWhatsapp();
  const { activeRole } = useImpersonation();
  const isAdmin = activeRole === 'admin';

  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const { data: accounts = [] } = useZapiAccounts();
  const hasSendableAccount = accounts.some((a) => a.status !== 'disconnected');
  // T65 (Fase 6 Onda A): aba campanhas visível se alguma conta tem c17 ativo
  const hasBroadcastEnabled = accounts.some((a) =>
    isFeatureEnabled(a.recursos_config as Record<string, boolean> | null, 'c17'),
  );
  // Primeira conta com c17 para usar na aba de campanhas
  const broadcastAccountId =
    accounts.find((a) =>
      isFeatureEnabled(a.recursos_config as Record<string, boolean> | null, 'c17'),
    )?.id ?? accounts[0]?.id ?? '';

  // T70 (Fase 6 Onda B): aba de eventos visível se alguma conta tem c20 ativo
  const hasEventosEnabled = accounts.some((a) =>
    isFeatureEnabled(a.recursos_config as Record<string, boolean> | null, 'c20'),
  );
  const eventosAccountId =
    accounts.find((a) =>
      isFeatureEnabled(a.recursos_config as Record<string, boolean> | null, 'c20'),
    )?.id ?? accounts[0]?.id ?? '';

  // T15: quando há deep-link e aba é diferente de conversas, corrige a tab na URL
  useEffect(() => {
    if (hasDeepLink && rawTab !== 'conversas') {
      setSearchParams(
        (prev) => {
          prev.set('tab', 'conversas');
          return prev;
        },
        { replace: true },
      );
    }
  }, [hasDeepLink, rawTab, setSearchParams]);

  // T13: ouve evento do ConversaPaletteDialog para abrir o NewMessageDialog (número avulso)
  useEffect(() => {
    function handleOpenNewMessage() {
      setNewMessageOpen(true);
    }
    window.addEventListener('open-new-message-dialog', handleOpenNewMessage);
    return () => window.removeEventListener('open-new-message-dialog', handleOpenNewMessage);
  }, []);

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
          {/* T65 (Fase 6 Onda A): aba de campanhas — só visível quando c17 ativo */}
          {hasBroadcastEnabled && (
            <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          )}
          {/* T70 (Fase 6 Onda B): aba de eventos — só visível quando c20 ativo */}
          {hasEventosEnabled && (
            <TabsTrigger value="eventos">Eventos</TabsTrigger>
          )}
          {/* T90 (Fase 7 Onda B): dashboard de atendimento — visível para admins */}
          {isAdmin && accounts.length > 0 && (
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          )}
          {/* T91 (Fase 7 Onda B): auditoria de atendimentos — somente admins */}
          {isAdmin && (
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          )}
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="space-y-4">
          <ContasTabContent />
        </TabsContent>

        <TabsContent value="conversas">
          {/* T15: passa deep-link params para que ConversasTabContent selecione o chat */}
          <ConversasTabContent
            initialChatPhone={chatParam ?? undefined}
            initialContactId={contactParam ?? undefined}
          />
        </TabsContent>

        {/* T65 (Fase 6 Onda A): gestão de campanhas broadcast */}
        {hasBroadcastEnabled && (
          <TabsContent value="campanhas" className="h-[700px]">
            <BroadcastsTabContent accountId={broadcastAccountId} />
          </TabsContent>
        )}

        {/* T70 (Fase 6 Onda B): gestão de eventos com convite e RSVP */}
        {hasEventosEnabled && (
          <TabsContent value="eventos" className="space-y-4">
            <EventosTabContent accountId={eventosAccountId} />
          </TabsContent>
        )}

        {/* T90 (Fase 7 Onda B): dashboard de atendimento */}
        {isAdmin && (
          <TabsContent value="dashboard" className="space-y-4">
            <DashboardAtendimentoTab />
          </TabsContent>
        )}

        {/* T91 (Fase 7 Onda B): auditoria de atendimentos */}
        {isAdmin && (
          <TabsContent value="auditoria" className="space-y-4">
            <AuditLogTab />
          </TabsContent>
        )}

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
