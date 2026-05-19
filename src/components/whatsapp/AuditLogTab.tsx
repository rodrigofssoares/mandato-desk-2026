// Componente: AuditLogTab
//
// Aba de auditoria de atendimentos WhatsApp — somente admins.
// Lista paginada de zapi_audit_log com filtros por conta, tipo de evento e período.
// Exportação CSV client-side.
//
// Referência: RAQ-MAND-EM073 — T91 (Fase 7 Onda B)

import { useState } from 'react';
import {
  ShieldCheck,
  Download,
  ChevronLeft,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui-system';
import { useImpersonation } from '@/context/ImpersonationContext';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import { useAuditLog, type AuditLogEntry } from '@/hooks/useAuditLog';
import { formatPhone } from '@/lib/zapi-format';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const EVENT_TYPE_LABELS: Record<string, string> = {
  status_change:  'Mudança de status',
  assignment:     'Atribuição',
  archive:        'Arquivamento',
  finalization:   'Finalização',
  ai_analysis:    'Análise de IA',
  ai_suggest:     'Sugestão de resposta',
  ai_transcribe:  'Transcrição de áudio',
  ai_next_action: 'Próxima ação sugerida',
};

const EVENT_TYPE_CLASS: Record<string, string> = {
  status_change:  'bg-blue-100 text-blue-700 border-blue-200',
  assignment:     'bg-purple-100 text-purple-700 border-purple-200',
  archive:        'bg-gray-100 text-gray-700 border-gray-200',
  finalization:   'bg-green-100 text-green-700 border-green-200',
  ai_analysis:    'bg-amber-100 text-amber-700 border-amber-200',
  ai_suggest:     'bg-amber-100 text-amber-700 border-amber-200',
  ai_transcribe:  'bg-amber-100 text-amber-700 border-amber-200',
  ai_next_action: 'bg-amber-100 text-amber-700 border-amber-200',
};

const ALL_EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS);

// ─── AuditLogTab ──────────────────────────────────────────────────────────────

export function AuditLogTab() {
  const { activeRole } = useImpersonation();
  const isAdmin = activeRole === 'admin';

  if (!isAdmin) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <EmptyState
          icon={Lock}
          title="Acesso restrito"
          description="Apenas administradores podem acessar o histórico de auditoria."
        />
      </div>
    );
  }

  return <AuditLogContent />;
}

function AuditLogContent() {
  const { data: accounts = [] } = useZapiAccounts();

  const [accountFilter, setAccountFilter] = useState<string>('__all__');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(0);

  const { data, isLoading } = useAuditLog({
    accountId: accountFilter === '__all__' ? undefined : accountFilter,
    eventTypes: eventTypeFilter === 'all' ? undefined : [eventTypeFilter],
    dateFrom: dateFrom || undefined,
    dateTo: dateTo ? `${dateTo}T23:59:59` : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const entries = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function handleExportCSV() {
    if (entries.length === 0) return;

    const header = ['Data/Hora', 'Tipo', 'Atendente', 'Conversa', 'Valor anterior', 'Valor novo'];
    const rows = entries.map((e) => [
      format(new Date(e.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      EVENT_TYPE_LABELS[e.event_type] ?? e.event_type,
      e.actor_nome ?? e.actor_id ?? '',
      e.chat_phone ? formatPhone(e.chat_phone) : e.chat_id ?? '',
      e.old_value ? JSON.stringify(e.old_value) : '',
      e.new_value ? JSON.stringify(e.new_value) : '',
    ]);

    const csvContent = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria-whatsapp-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    // appendChild + removeChild necessário para Firefox (link.click() sem estar no DOM não funciona)
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Conta */}
        <div className="space-y-1">
          <Label className="text-xs">Conta</Label>
          <Select value={accountFilter} onValueChange={(v) => { setAccountFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as contas</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tipo de evento */}
        <div className="space-y-1">
          <Label className="text-xs">Tipo de evento</Label>
          <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {ALL_EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data de */}
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
            className="w-36 h-9"
          />
        </div>

        {/* Data até */}
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
            className="w-36 h-9"
          />
        </div>

        {/* Exportar CSV */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={entries.length === 0}
          className="gap-1.5"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhum evento encontrado"
          description="Não há registros de auditoria para os filtros aplicados."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Atendente</TableHead>
                  <TableHead>Conversa</TableHead>
                  <TableHead>Alteração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">
                {totalCount} evento{totalCount !== 1 ? 's' : ''} •{' '}
                página {page + 1} de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── AuditRow ─────────────────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const eventLabel = EVENT_TYPE_LABELS[entry.event_type] ?? entry.event_type;
  const eventClass = EVENT_TYPE_CLASS[entry.event_type] ?? 'bg-gray-100 text-gray-700';

  // Formata o valor novo de forma amigável
  function formatValue(val: Record<string, unknown> | null): string {
    if (!val || Object.keys(val).length === 0) return '—';
    const entries = Object.entries(val);
    return entries
      .map(([k, v]) => `${k}: ${v === null ? 'removido' : String(v)}`)
      .join(', ');
  }

  return (
    <TableRow>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-[11px] ${eventClass}`}>
          {eventLabel}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {entry.actor_nome ?? (
          <span className="text-muted-foreground text-xs">sistema</span>
        )}
      </TableCell>
      <TableCell className="text-sm font-mono text-xs">
        {entry.chat_phone ? formatPhone(entry.chat_phone) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
        {formatValue(entry.new_value)}
      </TableCell>
    </TableRow>
  );
}
