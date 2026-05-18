// Componente: DashboardAtendimentoTab
//
// Aba de dashboard de atendimento WhatsApp — métricas por conta ou consolidadas.
// Cards: conversas abertas, finalizadas hoje, tempo médio de resposta.
// Tabela: produtividade por atendente.
// Auto-refresh a cada 60s via refetchInterval do hook.
//
// Referência: RAQ-MAND-EM073 — T90 (Fase 7 Onda B)

import { useState } from 'react';
import {
  BarChart2,
  Clock,
  CheckCircle2,
  Users,
  ExternalLink,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui-system';
import { useNavigate } from 'react-router-dom';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import {
  useDashboardAtendimento,
  type AtendenteStat,
} from '@/hooks/useDashboardAtendimento';

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatTempo(min: number | null | undefined): string {
  if (min == null) return '—';
  if (min < 1) return '< 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function userInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// ─── DashboardAtendimentoTab ──────────────────────────────────────────────────

export function DashboardAtendimentoTab() {
  const navigate = useNavigate();
  const { data: accounts = [], isLoading: accountsLoading } = useZapiAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('__all__');

  const { data: dashboard, isLoading, isFetching, refetch } = useDashboardAtendimento(
    accounts.length > 0 ? selectedAccountId : null,
  );

  if (accountsLoading) {
    return <DashboardSkeleton />;
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={BarChart2}
        title="Nenhuma conta configurada"
        description="Cadastre uma conta Z-API para ver o dashboard de atendimento."
      />
    );
  }

  const atendentes: AtendenteStat[] = dashboard?.conversas_por_atendente ?? [];

  return (
    <div className="space-y-6">
      {/* Seletor de conta + refresh */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecione uma conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os números</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Atualizar métricas"
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>

        <span className="text-xs text-muted-foreground">Atualiza automaticamente a cada 60s</span>
      </div>

      {/* Cards de KPI */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Conversas abertas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversas abertas</CardTitle>
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {dashboard?.conversas_abertas ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  aguardando ou em atendimento
                </p>
              </CardContent>
            </Card>

            {/* Finalizadas hoje */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Finalizadas hoje</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-700">
                  {dashboard?.conversas_finalizadas_hoje ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  conversas encerradas nas últimas 24h
                </p>
              </CardContent>
            </Card>

            {/* Tempo médio de resposta */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tempo médio de resposta</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatTempo(dashboard?.tempo_medio_resposta_min)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  do recebimento à 1ª resposta
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela por atendente */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Por atendente</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {atendentes.length === 0 ? (
                <div className="px-6 pb-6 pt-2">
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma conversa atribuída a atendentes no momento.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atendente</TableHead>
                        <TableHead className="text-right">Conversas atribuídas</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {atendentes.map((a) => (
                        <TableRow key={a.assigned_to ?? 'unassigned'}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[11px]">
                                  {userInitials(a.nome)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">
                                {a.nome ?? 'Sem nome'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {a.count}
                          </TableCell>
                          <TableCell>
                            {a.assigned_to && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-xs"
                                onClick={() =>
                                  navigate(
                                    `/whatsapp?tab=conversas&atendente=${a.assigned_to}`,
                                  )
                                }
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Ver
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
