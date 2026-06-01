import { Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function AgentNoAccessCard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold font-display mb-2">
              Acesso não autorizado
            </h2>
            <p className="text-sm text-muted-foreground">
              Você não tem permissão para acessar o Agente.
              Fale com o administrador para solicitar acesso.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
