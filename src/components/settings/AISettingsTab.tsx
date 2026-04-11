import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

export function AISettingsTab() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Central de IA</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
          <CardDescription>
            Central de configuração de IA — será preenchida na issue 35.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aqui o administrador poderá escolher o provider (Anthropic, OpenAI, Google), o modelo, cadastrar
            a chave de API e habilitar features de IA disponíveis no sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
