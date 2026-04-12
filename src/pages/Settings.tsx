import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Settings as SettingsIcon } from 'lucide-react';
import { GeneralTab } from '@/components/settings/GeneralTab';
import { FunisTab } from '@/components/settings/FunisTab';
import { TeamTab } from '@/components/settings/TeamTab';
import { PermsTab } from '@/components/settings/PermsTab';
import { IntegrationsTab } from '@/components/settings/IntegrationsTab';
import { AISettingsTab } from '@/components/settings/AISettingsTab';
import { BrandingTab } from '@/components/settings/BrandingTab';
import { usePermissions } from '@/hooks/usePermissions';

const TABS = [
  'geral',
  'funis',
  'equipe',
  'permissoes',
  'integracoes',
  'ia',
  'personalizacao',
] as const;
type SettingsTab = (typeof TABS)[number];

const DEFAULT_TAB: SettingsTab = 'geral';

function isValidTab(value: string | null): value is SettingsTab {
  return value !== null && (TABS as readonly string[]).includes(value);
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: SettingsTab = isValidTab(rawTab) ? rawTab : DEFAULT_TAB;

  const { can, isLoading: isPermLoading } = usePermissions();
  const canAccess = can.accessSettings();

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
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Você não tem permissão para acessar as Configurações.
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleTabChange = (value: string) => {
    if (!isValidTab(value)) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    // ao trocar de aba principal, limpa sub-aba de integrações
    if (value !== 'integracoes') {
      next.delete('sub');
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="funis">Funis</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="ia">IA</TabsTrigger>
          <TabsTrigger value="personalizacao">Personalização</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="funis" className="mt-4">
          <FunisTab />
        </TabsContent>
        <TabsContent value="equipe" className="mt-4">
          <TeamTab />
        </TabsContent>
        <TabsContent value="permissoes" className="mt-4">
          <PermsTab />
        </TabsContent>
        <TabsContent value="integracoes" className="mt-4">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="ia" className="mt-4">
          <AISettingsTab />
        </TabsContent>
        <TabsContent value="personalizacao" className="mt-4">
          <BrandingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
