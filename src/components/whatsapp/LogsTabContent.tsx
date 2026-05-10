import { useState } from 'react';
import { Lock, ScrollText, ChevronLeft, ChevronRight, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui-system';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useImpersonation } from '@/context/ImpersonationContext';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import { useZapiWebhookLogs, type ZapiWebhookLog } from '@/hooks/useZapiWebhookLogs';

const EVENT_TYPES = [
  'ReceivedCallback',
  'MessageStatusCallback',
  'DisconnectedCallback',
  'ConnectedCallback',
] as const;

export function LogsTabContent() {
  const { activeRole } = useImpersonation();
  const isAdmin = activeRole === 'admin';
  const { data: accounts = [] } = useZapiAccounts();

  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ZapiWebhookLog | null>(null);

  const filters = {
    account_id: accountFilter === 'all' ? null : accountFilter,
    event_type: eventFilter === 'all' ? null : eventFilter,
    page,
  };

  const { data, isLoading, isFetching, refetch } = useZapiWebhookLogs(filters, isAdmin);

  if (!isAdmin) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <EmptyState
          icon={Lock}
          title="Acesso restrito"
          description="Somente administradores podem visualizar logs de webhook Z-API."
        />
      </div>
    );
  }

  const logs = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const pageSize = data?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="space-y-1 flex-1 min-w-0">
          <label className="text-[11px] font-medium text-muted-foreground">Conta</label>
          <Select
            value={accountFilter}
            onValueChange={(v) => {
              setAccountFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 flex-1 min-w-0">
          <label className="text-[11px] font-medium text-muted-foreground">Tipo de evento</label>
          <Select
            value={eventFilter}
            onValueChange={(v) => {
              setEventFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Tabela */}
      <div className="border rounded-lg bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={ScrollText}
              title="Sem registros"
              description="Nenhum evento de webhook recebido com os filtros atuais."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Recebido em</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const accountName =
                  accounts.find((a) => a.id === log.account_id)?.name ?? (
                    log.account_id ? <span className="font-mono text-[11px]">{log.account_id.slice(0, 8)}...</span> : '—'
                  );
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {new Date(log.received_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{log.event_type}</TableCell>
                    <TableCell className="text-xs">{accountName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={log.processing_status === 'processed' ? 'secondary' : 'destructive'}
                        className="text-[10px]"
                      >
                        {log.processing_status === 'processed' ? 'OK' : 'Erro'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setSelectedLog(log)}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Paginação */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Página {page + 1} de {totalPages} · {totalCount} registros
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isFetching}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.hasMore || isFetching}
            >
              Próxima <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Sheet de detalhe */}
      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhe do evento</SheetTitle>
            <SheetDescription>
              {selectedLog && (
                <>
                  <span className="font-mono">{selectedLog.event_type}</span> · recebido em{' '}
                  {new Date(selectedLog.received_at).toLocaleString('pt-BR')}
                </>
              )}
            </SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="mt-4 space-y-4">
              {selectedLog.processing_status === 'error' && selectedLog.error_detail && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
                  <p className="text-xs font-medium text-destructive mb-1">Erro de processamento</p>
                  <p className="text-xs text-destructive font-mono whitespace-pre-wrap">
                    {selectedLog.error_detail}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Payload</p>
                <pre className="text-[11px] bg-muted p-3 rounded-md overflow-auto max-h-[60vh] font-mono">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
