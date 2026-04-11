import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, UserPlus, CheckCircle2, Megaphone } from 'lucide-react';

import { StatCardWithDelta } from '@/components/dashboard/StatCardWithDelta';
import { PeriodSelector } from '@/components/dashboard/PeriodSelector';
import { BoardFunnelCard } from '@/components/dashboard/BoardFunnelCard';
import { TarefasHojeCard } from '@/components/dashboard/TarefasHojeCard';
import { AlertsBadge } from '@/components/dashboard/AlertsBadge';
import { AlertsModal } from '@/components/dashboard/AlertsModal';
import { SaudeBaseCard } from '@/components/dashboard/SaudeBaseCard';

import { GrowthChart } from '@/components/dashboard/GrowthChart';
import { TagDistributionChart } from '@/components/dashboard/TagDistributionChart';
import { VoteDeclarationChart } from '@/components/dashboard/VoteDeclarationChart';
import { BirthdaySection } from '@/components/dashboard/BirthdaySection';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';

import { useBoards } from '@/hooks/useBoards';
import {
  useDashboardMetrics,
  type DashboardPeriod,
} from '@/hooks/useDashboardMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  hoje: 'hoje',
  '7d': 'nos últimos 7 dias',
  '30d': 'nos últimos 30 dias',
  mes: 'neste mês',
};

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [alertsOpen, setAlertsOpen] = useState(false);

  const period = (searchParams.get('period') as DashboardPeriod) || 'mes';
  const boardParam = searchParams.get('board');

  const { data: boards = [] } = useBoards('contact');

  // Resolução do boardId ativo: URL > default > primeiro
  const activeBoardId = useMemo(() => {
    if (boardParam && boards.some((b) => b.id === boardParam)) return boardParam;
    const def = boards.find((b) => b.is_default);
    if (def) return def.id;
    return boards[0]?.id ?? null;
  }, [boardParam, boards]);

  const { data: metrics, isLoading } = useDashboardMetrics(period, activeBoardId);

  const setPeriod = (p: DashboardPeriod) => {
    const next = new URLSearchParams(searchParams);
    next.set('period', p);
    setSearchParams(next, { replace: true });
  };

  const setBoard = (boardId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('board', boardId);
    setSearchParams(next, { replace: true });
  };

  const novosHint = `${PERIOD_LABELS[period]}`;
  const votoHint = metrics
    ? `${metrics.votoDeclarado.taxa.toFixed(1)}% taxa`
    : undefined;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodSelector value={period} onChange={setPeriod} />
          <AlertsBadge
            count={metrics?.alertas.length ?? 0}
            onClick={() => setAlertsOpen(true)}
          />
        </div>
      </div>

      {/* ── 4 StatCards com delta ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardWithDelta
          label="Base Total"
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-500/10"
          value={metrics?.baseTotal.current ?? 0}
          deltaPct={metrics?.baseTotal.deltaPct}
          isLoading={isLoading}
        />
        <StatCardWithDelta
          label="Novos"
          icon={UserPlus}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-500/10"
          value={metrics?.novosNoPeriodo.current ?? 0}
          deltaPct={metrics?.novosNoPeriodo.deltaPct}
          hint={novosHint}
          isLoading={isLoading}
        />
        <StatCardWithDelta
          label="Voto Declarado"
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-500/10"
          value={metrics?.votoDeclarado.current ?? 0}
          deltaPct={metrics?.votoDeclarado.deltaPct}
          hint={votoHint}
          isLoading={isLoading}
        />
        <StatCardWithDelta
          label="Multiplicadores"
          icon={Megaphone}
          iconColor="text-purple-600"
          iconBg="bg-purple-500/10"
          value={metrics?.multiplicadores.current ?? 0}
          deltaPct={metrics?.multiplicadores.deltaPct}
          isLoading={isLoading}
        />
      </div>

      {/* ── Grid principal: Funil + Tarefas/Aniversários ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BoardFunnelCard
            boards={boards}
            activeBoardId={activeBoardId}
            onChangeBoard={setBoard}
            stages={metrics?.funilStages ?? []}
            isLoading={isLoading}
          />
        </div>
        <div className="space-y-6">
          <TarefasHojeCard />
          <BirthdaySection />
        </div>
      </div>

      {/* ── Saúde da Base ───────────────────────────────────── */}
      <SaudeBaseCard data={metrics?.saudeBase} isLoading={isLoading} />

      {/* ── Linha inferior: Crescimento + Activity Feed ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GrowthChart />
        </div>
        <div>
          <ActivityFeed />
        </div>
      </div>

      {/* ── Mais: charts secundários ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mais métricas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TagDistributionChart />
          <VoteDeclarationChart />
        </CardContent>
      </Card>

      {/* ── Modal de alertas ──────────────────────────────────── */}
      <AlertsModal
        open={alertsOpen}
        onOpenChange={setAlertsOpen}
        alerts={metrics?.alertas ?? []}
      />
    </div>
  );
}
