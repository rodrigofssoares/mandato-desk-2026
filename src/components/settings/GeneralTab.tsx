import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SlidersHorizontal } from 'lucide-react';
import { CustomFieldsManager } from './CustomFieldsManager';

export function GeneralTab() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SlidersHorizontal className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Geral</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campos Personalizados</CardTitle>
          <CardDescription>
            Adicione campos extras para classificar seus contatos com informações específicas do seu
            mandato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomFieldsManager />
        </CardContent>
      </Card>
    </div>
  );
}
