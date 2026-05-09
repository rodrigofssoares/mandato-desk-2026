import { useSearchParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui-system';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContasTabContent } from '@/components/whatsapp/ContasTabContent';
import { ConversasTabContent } from '@/components/whatsapp/ConversasTabContent';
import { WebhooksTabContent } from '@/components/whatsapp/WebhooksTabContent';
import { LogsTabContent } from '@/components/whatsapp/LogsTabContent';

const TABS = ['contas', 'conversas', 'webhooks', 'logs'] as const;
type Tab = (typeof TABS)[number];

function isValidTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab);
}

export default function Whatsapp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: Tab = isValidTab(rawTab) ? rawTab : 'contas';

  function handleTabChange(value: string) {
    setSearchParams({ tab: value }, { replace: true });
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Integrações"
        title="WhatsApp"
        description="Gerencie contas Z-API, acompanhe conversas com eleitores e monitore webhooks."
        icon={MessageCircle}
        iconVariant="success"
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
    </div>
  );
}
