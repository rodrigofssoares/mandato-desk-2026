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
import { EditableDashboard } from '@/components/dashboard/EditableDashboard';

import { useBoards } from '@/hooks/useBoards';
import {
  useDashboardMetrics,
  type DashboardPeriod,
} from '@/hooks/useDashboardMetrics';
import { usePermissions } from '@/hooks/usePermissions';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import {
  resolveChartType,
  type ChartViewType,
  type DashboardWidgetId,
} from '@/lib/dashboardLayout';

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
  const { can } = usePermissions();
  const canEdit = can.editDashboardLayout();

  const { widgetPrefs, setChartType } = useDashboardLayout();

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

  const handleChartTypeChange = (widgetId: DashboardWidgetId) =>
    canEdit
      ? (type: ChartViewType) => {
          setChartType(widgetId, type).catch((err) => {
            console.error(err);
          });
        }
      : undefined;

  const novosHint = `${PERIOD_LABELS[period]}`;
  const votoHint = metrics
    ? `${metrics.votoDeclarado.taxa.toFixed(1)}% taxa`
    : undefined;

  const widgets: Record<DashboardWidgetId, React.ReactNode> = {
    funnel: (
      <BoardFunnelCard
        boards={boards}
        activeBoardId={activeBoardId}
        onChangeBoard={setBoard}
        stages={metrics?.funilStages ?? []}
        isLoading={isLoading}
        viewType={resolveChartType('funnel', widgetPrefs)}
        onChangeViewType={handleChartTypeChange('funnel')}
      />
    ),
    tarefas: <TarefasHojeCard />,
    aniversarios: <BirthdaySection />,
    'saude-base': <SaudeBaseCard data={metrics?.saudeBase} isLoading={isLoading} />,
    crescimento: <GrowthChart />,
    atividades: <ActivityFeed />,
    tags: (
      <TagDistributionChart
        viewType={resolveChartType('tags', widgetPrefs)}
        onChangeViewType={handleChartTypeChange('tags')}
      />
    ),
    voto: (
      <VoteDeclarationChart
        viewType={resolveChartType('voto', widgetPrefs)}
        onChangeViewType={handleChartTypeChange('voto')}
      />
    ),
  };

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

      {/* ── 4 StatCards fixos no topo (não editáveis) ──────────── */}
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

      {/* ── Grid editável com os demais widgets ────────────────── */}
      <EditableDashboard widgets={widgets} canEdit={canEdit} />

      {/* ── Modal de alertas ──────────────────────────────────── */}
      <AlertsModal
        open={alertsOpen}
        onOpenChange={setAlertsOpen}
        alerts={metrics?.alertas ?? []}
      />
    </div>
  );
}
