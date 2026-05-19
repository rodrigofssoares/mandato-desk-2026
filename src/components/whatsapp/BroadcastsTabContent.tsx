// BroadcastsTabContent.tsx
// Tela de gestão de campanhas broadcast (T65 / Fase 6 Onda A).
// T75 (Fase 6 Onda B): suporte a resultados de enquete.
// Exibe lista de campanhas com status em tempo real (Realtime), filtros e
// botão para criar nova campanha (abre BroadcastComposerDialog).

import { useState } from 'react';
import {
  Megaphone,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  BarChart3,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui-system';
import { useZapiBroadcasts, useZapiBroadcastTargets, type ZapiBroadcast } from '@/hooks/useZapiBroadcasts';
import { useBroadcastPollVotes } from '@/hooks/useBroadcastPollVotes';
import { BroadcastComposerDialog } from './BroadcastComposerDialog';

interface BroadcastsTabContentProps {
  accountId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  rascunho:  'Rascunho',
  agendado:  'Agendado',
  enviando:  'Enviando',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  falha:     'Falha',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  rascunho:  'bg-muted text-muted-foreground',
  agendado:  'bg-blue-100 text-blue-700 border-blue-200',
  enviando:  'bg-amber-100 text-amber-700 border-amber-200',
  concluido: 'bg-green-100 text-green-700 border-green-200',
  cancelado: 'bg-red-100 text-red-700 border-red-200',
  falha:     'bg-red-100 text-red-700 border-red-200',
};

const TIPO_LABELS: Record<string, string> = {
  mensagem: 'Mensagem',
  enquete:  'Enquete',
};

// ── BroadcastTargetsDrawer (subcomponente de detalhes) ────────────────────────

function BroadcastTargetsDrawer({ broadcastId }: { broadcastId: string }) {
  const { data: targets = [], isLoading } = useZapiBroadcastTargets(broadcastId);

  const TARGET_STATUS_CLASS: Record<string, string> = {
    pendente:  'text-muted-foreground',
    enviado:   'text-green-600',
    falha:     'text-destructive',
    bloqueado: 'text-amber-600',
  };

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        Destinatários ({targets.length})
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando...
        </div>
      ) : targets.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">Nenhum destinatário</p>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {targets.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-muted/50"
            >
              <span className="font-mono text-muted-foreground">{t.phone}</span>
              <div className="flex items-center gap-2">
                {t.sent_at && (
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(t.sent_at), 'HH:mm', { locale: ptBR })}
                  </span>
                )}
                <span className={`font-medium ${TARGET_STATUS_CLASS[t.status] ?? ''}`}>
                  {t.status}
                </span>
                {t.error_msg && (
                  <span className="text-[10px] text-destructive truncate max-w-[120px]" title={t.error_msg}>
                    {t.error_msg}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PollResultsPanel ──────────────────────────────────────────────────────────

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

function PollResultsPanel({ broadcastId }: { broadcastId: string }) {
  const { data, isLoading } = useBroadcastPollVotes(broadcastId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando resultados...
      </div>
    );
  }

  if (!data || data.results.totalVotes === 0) {
    return (
      <p className="text-xs text-muted-foreground italic py-2">
        Nenhum voto registrado ainda.
      </p>
    );
  }

  const { results } = data;
  const chartData = Object.entries(results.byOption).map(([option, count]) => ({
    option: option.length > 20 ? `${option.slice(0, 18)}…` : option,
    votos: count,
    pct: results.uniqueParticipants > 0
      ? Math.round((count / results.uniqueParticipants) * 100)
      : 0,
  }));

  return (
    <div className="space-y-3 mt-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{results.uniqueParticipants}</strong> participantes</span>
        <span><strong className="text-foreground">{results.totalVotes}</strong> votos</span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(80, chartData.length * 36)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="option" width={120} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number, _name: string, entry) => [
              `${value} votos (${(entry.payload as { pct: number }).pct}%)`,
              'Votos',
            ]}
            contentStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="votos" radius={[0, 4, 4, 0]}>
            {chartData.map((_entry, index) => (
              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── BroadcastCard ──────────────────────────────────────────────────────────────

function BroadcastCard({ broadcast }: { broadcast: ZapiBroadcast }) {
  const [expanded, setExpanded] = useState(false);
  const [showPollResults, setShowPollResults] = useState(false);

  const progress =
    broadcast.total_targets > 0
      ? Math.round(
          ((broadcast.sent_count + broadcast.failed_count) / broadcast.total_targets) * 100,
        )
      : 0;

  return (
    <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{broadcast.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {format(new Date(broadcast.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="secondary"
            className={`text-[10px] ${STATUS_BADGE_CLASS[broadcast.status] ?? ''} ${
              broadcast.status === 'enviando' ? 'animate-pulse' : ''
            }`}
          >
            {STATUS_LABELS[broadcast.status] ?? broadcast.status}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {TIPO_LABELS[broadcast.tipo] ?? broadcast.tipo}
          </Badge>
        </div>
      </div>

      {/* Contadores */}
      {broadcast.total_targets > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {broadcast.sent_count}/{broadcast.total_targets} enviados
              {broadcast.failed_count > 0 && (
                <span className="text-destructive ml-1">
                  · {broadcast.failed_count} falhas
                </span>
              )}
            </span>
            <span>{progress}%</span>
          </div>
          {broadcast.status !== 'rascunho' && (
            <Progress value={progress} className="h-1.5" />
          )}
        </div>
      )}

      {/* Agendado */}
      {broadcast.scheduled_at && broadcast.status === 'agendado' && (
        <div className="flex items-center gap-1.5 text-xs text-blue-600">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Agendado para{' '}
          {format(new Date(broadcast.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      )}

      {/* Ações: targets + resultados de enquete */}
      <div className="flex items-center gap-2">
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] gap-1 text-muted-foreground px-1"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" />Ocultar destinatários</>
              ) : (
                <><ChevronDown className="h-3 w-3" />Ver destinatários</>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {expanded && <BroadcastTargetsDrawer broadcastId={broadcast.id} />}
          </CollapsibleContent>
        </Collapsible>

        {/* T75: botão de resultados apenas para enquetes */}
        {broadcast.tipo === 'enquete' && (
          <Collapsible open={showPollResults} onOpenChange={setShowPollResults}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] gap-1 text-primary px-1"
              >
                <BarChart3 className="h-3 w-3" />
                {showPollResults ? 'Ocultar resultados' : 'Ver resultados'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {showPollResults && <PollResultsPanel broadcastId={broadcast.id} />}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

// ── BroadcastsTabContent ──────────────────────────────────────────────────────

export function BroadcastsTabContent({ accountId }: BroadcastsTabContentProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: broadcasts = [], isLoading, refetch } = useZapiBroadcasts(accountId);

  const filtered =
    statusFilter === 'all'
      ? broadcasts
      : broadcasts.filter((b) => b.status === statusFilter);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => void refetch()}
            title="Atualizar"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setComposerOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Nova campanha
        </Button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando campanhas...</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Nenhuma campanha encontrada"
            description={
              statusFilter === 'all'
                ? 'Crie a primeira campanha de comunicação com o botão acima.'
                : `Nenhuma campanha com status "${STATUS_LABELS[statusFilter] ?? statusFilter}".`
            }
          />
        ) : (
          filtered.map((b) => <BroadcastCard key={b.id} broadcast={b} />)
        )}
      </div>

      {/* Composer */}
      <BroadcastComposerDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        accountId={accountId}
      />
    </div>
  );
}
