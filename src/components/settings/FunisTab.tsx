import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GitBranch } from 'lucide-react';
import { BoardsListPanel } from './BoardsListPanel';

export function FunisTab() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Funis</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Boards de contatos</CardTitle>
          <CardDescription>
            Configure os funis usados na aba Board. Cada board tem seus próprios estágios e pode ser
            marcado como padrão para aparecer ao abrir a página Board.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BoardsListPanel />
        </CardContent>
      </Card>
    </div>
  );
}
