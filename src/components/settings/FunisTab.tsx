import { Card, CardContent } from '@/components/ui/card';
import { GitBranch } from 'lucide-react';
import { PageHeader, PanelHeader } from '@/components/ui-system';
import { BoardsListPanel } from './BoardsListPanel';

export function FunisTab() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Configuração"
        title="Funis"
        icon={GitBranch}
        iconVariant="primary"
      />

      <Card>
        <PanelHeader
          title="Funis de contatos"
          description="Configure os funis usados na aba Funil. Cada um tem seus próprios estágios e pode ser marcado como padrão pra aparecer ao abrir a página Funil."
          icon={GitBranch}
          iconVariant="primary"
        />
        <CardContent>
          <BoardsListPanel />
        </CardContent>
      </Card>
    </div>
  );
}
