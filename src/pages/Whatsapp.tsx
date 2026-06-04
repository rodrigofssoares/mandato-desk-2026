import { useState, useEffect, useMemo } from 'react';
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
import { TrashPanel } from '@/components/whatsapp/TrashPanel';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import { usePermissions } from '@/hooks/usePermissions';
import { useImpersonation } from '@/context/ImpersonationContext';
import { isFeatureEnabled } from '@/lib/featureFlags';

// T65 (Fase 6 Onda A): aba de campanhas visível se ao menos 1 conta tem c17 ativo
// T70 (Fase 6 Onda B): aba de eventos visível se ao menos 1 conta tem c20 ativo
// T90 (Fase 7 Onda B): aba de dashboard de atendimento — visível para admins com contas
// T91 (Fase 7 Onda B): aba de auditoria — visível somente para admins
// EM080: tier-based tab gating — privilegiado (admin|proprietario) vs. restrito (demais)
// EM082: aba de lixeira — admin-only (canBulkDelete whatsapp)
const TABS = ['contas', 'conversas', 'campanhas', 'eventos', 'dashboard', 'auditoria', 'webhooks', 'logs', 'lixeira'] as const;
type Tab = (typeof TABS)[number];

function isValidTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab);
}

export default function Whatsapp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const chatParam = searchParams.get('chat');
  const contactParam = searchParams.get('contact');
  const hasDeepLink = !!(chatParam || contactParam);

  const { can, isLoading: isPermLoading } = usePermissions();
  const canAccess = can.accessWhatsapp();
  const canViewTrash = can.bulkDeleteWhatsapp();
  const { activeRole } = useImpersonation();

  // EM080: privilegiado = admin | proprietario; restrito = demais
  const isPrivileged = activeRole === 'admin' || activeRole === 'proprietario';
  const isAdmin = activeRole === 'admin';

  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const { data: accounts = [] } = useZapiAccounts();
  const hasSendableAccount = accounts.some((a) => a.status !== 'disconnected');

  // T65: aba campanhas visível se alguma conta tem c17 ativo
  const hasBroadcastEnabled = accounts.some((a) =>
    isFeatureEnabled(a.recursos_config as Record<string, boolean> | null, 'c17'),
  );
  const broadcastAccountId =
    accounts.find((a) =>
      isFeatureEnabled(a.recursos_config as Record<string, boolean> | null, 'c17'),
    )?.id ?? accounts[0]?.id ?? '';

  // T70: aba eventos visível se alguma conta tem c20 ativo
  const hasEventosEnabled = accounts.some((a) =>
    isFeatureEnabled(a.recursos_config as Record<string, boolean> | null, 'c20'),
  );
  const eventosAccountId =
    accounts.find((a) =>
      isFeatureEnabled(a.recursos_config as Record<string, boolean> | null, 'c20'),
    )?.id ?? accounts[0]?.id ?? '';

  // EM080: calcula conjunto de abas disponíveis para o tier atual
  // Restrito: apenas 'conversas'. Privilegiado: conversas + contas + campanhas + eventos.
  // Admin-only: dashboard, auditoria, webhooks, logs, lixeira.
  const availableTabs = useMemo(() => {
    const tabs = new Set<Tab>(['conversas']);
    if (isPrivileged) {
      tabs.add('contas');
      if (hasBroadcastEnabled) tabs.add('campanhas');
      if (hasEventosEnabled) tabs.add('eventos');
    }
    if (isAdmin) {
      if (accounts.length > 0) tabs.add('dashboard');
      tabs.add('auditoria');
      tabs.add('webhooks');
      tabs.add('logs');
    }
    // EM082: lixeira — visível apenas para quem tem canBulkDelete('whatsapp')
    if (canViewTrash) tabs.add('lixeira');
    return tabs;
  }, [isPrivileged, isAdmin, canViewTrash, accounts.length, hasBroadcastEnabled, hasEventosEnabled]);

  // Resolve a aba ativa: deep-link força conversas; aba pedida não disponível → fallback conversas
  const resolvedTab: Tab = hasDeepLink
    ? 'conversas'
    : isValidTab(rawTab) && availableTabs.has(rawTab as Tab)
      ? (rawTab as Tab)
      : 'conversas';

  const activeTab = resolvedTab;

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

  // EM080: quando aba pedida na URL não está disponível pro tier, redireciona pra conversas
  useEffect(() => {
    if (!isPermLoading && rawTab && isValidTab(rawTab) && !availableTabs.has(rawTab)) {
      setSearchParams({ tab: 'conversas' }, { replace: true });
    }
  }, [isPermLoading, rawTab, availableTabs, setSearchParams]);

  // T13: ouve evento do ConversaPaletteDialog para abrir o NewMessageDialog (número avulso)
  useEffect(() => {
    function handleOpenNewMessage() {
      setNewMessageOpen(true);
    }
    window.addEventListener('open-new-message-dialog', handleOpenNewMessage);
    return () => window.removeEventListener('open-new-message-dialog', handleOpenNewMessage);
  }, []);

  function handleTabChange(value: string) {
    // Segurança extra: restrito não consegue navegar pra aba proibida via clique
    if (!availableTabs.has(value as Tab)) return;
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
          {/* EM080: Conversas — sempre visível */}
          <TabsTrigger value="conversas">Conversas</TabsTrigger>

          {/* EM080: Contas — somente privilegiado */}
          {isPrivileged && (
            <TabsTrigger value="contas">Contas</TabsTrigger>
          )}

          {/* T65 (Fase 6 Onda A): Campanhas — privilegiado + c17 ativo */}
          {isPrivileged && hasBroadcastEnabled && (
            <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          )}

          {/* T70 (Fase 6 Onda B): Eventos — privilegiado + c20 ativo */}
          {isPrivileged && hasEventosEnabled && (
            <TabsTrigger value="eventos">Eventos</TabsTrigger>
          )}

          {/* T90 (Fase 7 Onda B): Dashboard — admin-only com contas */}
          {isAdmin && accounts.length > 0 && (
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          )}

          {/* T91 (Fase 7 Onda B): Auditoria — admin-only */}
          {isAdmin && (
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          )}

          {/* EM080: Webhooks — admin-only (antes vazava pra todos) */}
          {isAdmin && (
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          )}

          {/* EM080: Logs — admin-only (antes vazava pra todos) */}
          {isAdmin && (
            <TabsTrigger value="logs">Logs</TabsTrigger>
          )}

          {/* EM082: Lixeira — admin-only (canBulkDelete whatsapp) */}
          {canViewTrash && (
            <TabsTrigger value="lixeira">Lixeira</TabsTrigger>
          )}
        </TabsList>

        {/* EM080: TabsContent condicionais — restrito não consegue forçar via ?tab= */}

        <TabsContent value="conversas">
          {/* T15: passa deep-link params para que ConversasTabContent selecione o chat */}
          {/* EM082: onViewTrash navega para a aba lixeira após confirmar limpeza */}
          <ConversasTabContent
            initialChatPhone={chatParam ?? undefined}
            initialContactId={contactParam ?? undefined}
            onViewTrash={canViewTrash ? () => handleTabChange('lixeira') : undefined}
          />
        </TabsContent>

        {isPrivileged && (
          <TabsContent value="contas" className="space-y-4">
            <ContasTabContent />
          </TabsContent>
        )}

        {/* T65 (Fase 6 Onda A): gestão de campanhas broadcast */}
        {isPrivileged && hasBroadcastEnabled && (
          <TabsContent value="campanhas" className="h-[700px]">
            <BroadcastsTabContent accountId={broadcastAccountId} />
          </TabsContent>
        )}

        {/* T70 (Fase 6 Onda B): gestão de eventos com convite e RSVP */}
        {isPrivileged && hasEventosEnabled && (
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

        {/* EM080: Webhooks — admin-only */}
        {isAdmin && (
          <TabsContent value="webhooks">
            <WebhooksTabContent />
          </TabsContent>
        )}

        {/* EM080: Logs — admin-only */}
        {isAdmin && (
          <TabsContent value="logs">
            <LogsTabContent />
          </TabsContent>
        )}

        {/* EM082: Lixeira — admin-only (canBulkDelete whatsapp) */}
        {canViewTrash && (
          <TabsContent value="lixeira" className="space-y-4">
            <TrashPanel />
          </TabsContent>
        )}
      </Tabs>

      <NewMessageDialog open={newMessageOpen} onOpenChange={setNewMessageOpen} />
    </div>
  );
}
