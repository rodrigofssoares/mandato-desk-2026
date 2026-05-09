import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import type { SyncStatusCounts } from '@/hooks/useGoogleSync';

interface SyncStatusCardsProps {
  counts: SyncStatusCounts;
  lastFullSync: string | null;
  isLoading?: boolean;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Nunca';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function SyncStatusCards({ counts, lastFullSync, isLoading }: SyncStatusCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sincronizados</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : counts.synced}
            </div>
            <p className="text-xs text-muted-foreground">contatos no Google Contacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com erro</CardTitle>
            <AlertCircle className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">
              {isLoading ? '...' : counts.error}
            </div>
            <p className="text-xs text-muted-foreground">precisam de atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {isLoading ? '...' : counts.pending}
            </div>
            <p className="text-xs text-muted-foreground">aguardando sincronização</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Ultima sincronizacao completa:{' '}
        <span className="font-medium">{formatDateTime(lastFullSync)}</span>
      </p>
    </div>
  );
}
