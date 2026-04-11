import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CloudCog } from 'lucide-react';

export default function GoogleIntegration() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CloudCog className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Integração Google Contacts</h1>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Google Contacts</CardTitle>
            <Badge variant="secondary">Em desenvolvimento</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta funcionalidade permitirá sincronizar seus contatos do Google Contacts
            diretamente com o CRM, importando e exportando dados automaticamente.
          </p>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Recursos planejados:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Importação de contatos do Google</li>
              <li>Exportação de contatos para o Google</li>
              <li>Sincronização bidirecional automática</li>
              <li>Mapeamento de campos personalizados</li>
              <li>Detecção de duplicatas</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
