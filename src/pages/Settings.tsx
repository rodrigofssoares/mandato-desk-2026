import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Settings as SettingsIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui-system';
import { GeneralTab } from '@/components/settings/GeneralTab';
import { FunisTab } from '@/components/settings/FunisTab';
import { TeamTab } from '@/components/settings/TeamTab';
import { PermsTab } from '@/components/settings/PermsTab';
import { IntegrationsTab } from '@/components/settings/IntegrationsTab';
import { AISettingsTab } from '@/components/settings/AISettingsTab';
import { AgentSettingsTab } from '@/components/settings/AgentSettingsTab';
import { BrandingTab } from '@/components/settings/BrandingTab';
import { FilterOrderTab } from '@/components/settings/FilterOrderTab';
import { NavOrderTab } from '@/components/settings/NavOrderTab';
import { AlertasTab } from '@/components/settings/AlertasTab';
import { usePermissions } from '@/hooks/usePermissions';

const TABS = [
  'geral',
  'funis',
  'equipe',
  'permissoes',
  'integracoes',
  'ia',
  'agente',
  'personalizacao',
  'filtros',
  'nav-ordem',
  'alertas',
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
  const canAccessFiltros = can.accessOrdenacaoFiltros();
  const canEditAgente = can.editAgente();

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
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Personalize seu mandato, equipe, integrações e permissões."
        icon={SettingsIcon}
        iconVariant="primary"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="funis">Funis</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="ia">IA</TabsTrigger>
          {canEditAgente && (
            <TabsTrigger value="agente">
              Agente{' '}
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-[hsl(40,62%,55%)] text-foreground leading-none">
                novo
              </span>
            </TabsTrigger>
          )}
          <TabsTrigger value="personalizacao">Personalização</TabsTrigger>
          {canAccessFiltros && (
            <TabsTrigger value="filtros">Ordenação de Filtros</TabsTrigger>
          )}
          <TabsTrigger value="nav-ordem">Ordem das Abas</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
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
        {canEditAgente && (
          <TabsContent value="agente" className="mt-4">
            <AgentSettingsTab />
          </TabsContent>
        )}
        <TabsContent value="personalizacao" className="mt-4">
          <BrandingTab />
        </TabsContent>
        {canAccessFiltros && (
          <TabsContent value="filtros" className="mt-4">
            <FilterOrderTab />
          </TabsContent>
        )}
        <TabsContent value="nav-ordem" className="mt-4">
          <NavOrderTab />
        </TabsContent>
        <TabsContent value="alertas" className="mt-4">
          <AlertasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
