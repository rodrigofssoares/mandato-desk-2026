import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cable, Globe, Code, Webhook as WebhookIcon } from 'lucide-react';
import GoogleIntegration from '@/pages/GoogleIntegration';
import Api from '@/pages/Api';
import Webhooks from '@/pages/Webhooks';

const SUB_TABS = ['google', 'api', 'webhooks'] as const;
type SubTab = (typeof SUB_TABS)[number];

const DEFAULT_SUB: SubTab = 'google';

function isValidSub(value: string | null): value is SubTab {
  return value !== null && (SUB_TABS as readonly string[]).includes(value);
}

export function IntegrationsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSub = searchParams.get('sub');
  const activeSub: SubTab = isValidSub(rawSub) ? rawSub : DEFAULT_SUB;

  const handleChange = (value: string) => {
    if (!isValidSub(value)) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'integracoes');
    next.set('sub', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Cable className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Integrações</h1>
      </div>

      <Tabs value={activeSub} onValueChange={handleChange} className="w-full">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="google" className="gap-2">
            <Globe className="h-4 w-4" />
            Google
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Code className="h-4 w-4" />
            API
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <WebhookIcon className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="google" className="mt-4">
          <GoogleIntegration />
        </TabsContent>
        <TabsContent value="api" className="mt-4">
          <Api />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-4">
          <Webhooks />
        </TabsContent>
      </Tabs>
    </div>
  );
}
