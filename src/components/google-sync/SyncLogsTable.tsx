import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { GoogleSyncLog } from '@/hooks/useGoogleSync';

interface SyncLogsTableProps {
  logs: GoogleSyncLog[];
  isLoading?: boolean;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function operationLabel(op: string): string {
  const labels: Record<string, string> = {
    create: 'Criar',
    update: 'Atualizar',
    delete: 'Excluir',
  };
  return labels[op] ?? op;
}

function statusBadge(status: string) {
  if (status === 'success') {
    return <Badge variant="default" className="bg-success-soft text-success-soft-foreground hover:bg-success-soft">Sucesso</Badge>;
  }
  if (status === 'error') {
    return <Badge variant="destructive">Erro</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export function SyncLogsTable({ logs, isLoading }: SyncLogsTableProps) {
  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Carregando logs...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Nenhuma operacao registrada ainda.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data/Hora</TableHead>
          <TableHead>Contato</TableHead>
          <TableHead>Operacao</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Mensagem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="text-sm whitespace-nowrap">
              {formatDateTime(log.created_at)}
            </TableCell>
            <TableCell className="text-sm">
              {log.contacts?.nome ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="text-sm">{operationLabel(log.operation)}</TableCell>
            <TableCell>{statusBadge(log.status)}</TableCell>
            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
              {log.error_message ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
