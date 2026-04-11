import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GitBranch } from 'lucide-react';

export function FunisTab() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Funis</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
          <CardDescription>
            Gerenciamento de boards e estágios — será preenchida na issue 34.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aqui você poderá criar e editar funis (boards) de contatos, definir estágios, reordenar colunas
            via drag-and-drop e marcar um board como padrão da organização.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
