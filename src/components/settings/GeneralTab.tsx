import { Card, CardContent } from '@/components/ui/card';
import { SlidersHorizontal, Wand2 } from 'lucide-react';
import { PageHeader, PanelHeader } from '@/components/ui-system';
import { CustomFieldsManager } from './CustomFieldsManager';

export function GeneralTab() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Configuração"
        title="Geral"
        icon={SlidersHorizontal}
        iconVariant="primary"
      />

      <Card>
        <PanelHeader
          title="Campos Personalizados"
          description="Adicione campos extras pra classificar seus contatos com informações específicas do seu mandato."
          icon={Wand2}
          iconVariant="accent"
        />
        <CardContent>
          <CustomFieldsManager />
        </CardContent>
      </Card>
    </div>
  );
}
