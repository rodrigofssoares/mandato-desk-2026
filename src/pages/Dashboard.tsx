import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, UserPlus, CheckCircle2, Crown, LayoutDashboard } from 'lucide-react';
import { startOfMonth, format } from 'date-fns';

import { PageHeader } from '@/components/ui-system';

import { StatCardWithDelta } from '@/components/dashboard/StatCardWithDelta';
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
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useDismissedAlerts } from '@/hooks/useDismissedAlerts';
import { usePermissions } from '@/hooks/usePermissions';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useBranding } from '@/hooks/useBranding';
import {
  resolveChartType,
  type ChartViewType,
  type DashboardWidgetId,
} from '@/lib/dashboardLayout';

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [alertsOpen, setAlertsOpen] = useState(false);

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

  const { data: metrics, isLoading } = useDashboardMetrics('mes', activeBoardId);
  const { data: branding } = useBranding();
  const { dismissedKeys, dismissOne, dismissMany } = useDismissedAlerts();

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

  // Filtra alertas já dispensados pelo usuário antes de exibir no badge e modal.
  // Estratégia Opção A (recomendada no Backlog): filtro em Dashboard.tsx, mantendo
  // useDashboardMetrics sem dependências de dismissals.
  const alertasFiltrados = useMemo(
    () => (metrics?.alertas ?? []).filter((a) => !dismissedKeys.has(a.id)),
    [metrics?.alertas, dismissedKeys]
  );

  const metaVotos = branding?.meta_votos ?? null;
  const temMeta = metaVotos != null && metaVotos > 0;
  const votoAtual = metrics?.votoDeclarado.current ?? 0;

  const votoValue: number | string = temMeta
    ? `${votoAtual.toLocaleString('pt-BR')} / ${metaVotos!.toLocaleString('pt-BR')}`
    : votoAtual;

  const votoProgressPct = temMeta ? (votoAtual / metaVotos!) * 100 : null;

  const votoHint = temMeta
    ? `${votoProgressPct!.toFixed(1)}% da meta`
    : metrics
    ? `${metrics.votoDeclarado.taxa.toFixed(1)}% taxa`
    : undefined;

  const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const novosHref = `/contacts?date_from=${inicioMes}`;

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
      {/* ── Header padronizado (PageHeader do design system) ─────── */}
      <PageHeader
        eyebrow="Painel principal"
        title="Visão Geral"
        description="Métricas em tempo real da sua base e funil eleitoral."
        icon={LayoutDashboard}
        iconVariant="primary"
        actions={
          <AlertsBadge
            count={alertasFiltrados.length}
            onClick={() => setAlertsOpen(true)}
          />
        }
      />

      {/* ── 4 StatCards fixos no topo (não editáveis) ──────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardWithDelta
          label="Base Total"
          icon={Users}
          iconVariant="info"
          value={metrics?.baseTotal.current ?? 0}
          deltaPct={metrics?.baseTotal.deltaPct}
          href="/contacts"
          isLoading={isLoading}
        />
        <StatCardWithDelta
          label="Novos"
          icon={UserPlus}
          iconVariant="success"
          value={metrics?.novosNoPeriodo.current ?? 0}
          deltaPct={metrics?.novosNoPeriodo.deltaPct}
          hint="neste mês"
          href={novosHref}
          isLoading={isLoading}
        />
        <StatCardWithDelta
          label="Voto Declarado"
          icon={CheckCircle2}
          iconVariant="primary"
          value={votoValue}
          deltaPct={metrics?.votoDeclarado.deltaPct}
          hint={votoHint}
          progressPct={votoProgressPct}
          href="/contacts?declarou_voto=true"
          isLoading={isLoading}
        />
        <StatCardWithDelta
          label="Articuladores"
          icon={Crown}
          iconVariant="accent"
          value={metrics?.articuladores.current ?? 0}
          deltaPct={metrics?.articuladores.deltaPct}
          href="/leaders"
          isLoading={isLoading}
        />
      </div>

      {/* ── Grid editável com os demais widgets ────────────────── */}
      <EditableDashboard widgets={widgets} canEdit={canEdit} />

      {/* ── Modal de alertas ──────────────────────────────────── */}
      <AlertsModal
        open={alertsOpen}
        onOpenChange={setAlertsOpen}
        alerts={alertasFiltrados}
        onDismissOne={dismissOne}
        onDismissMany={dismissMany}
      />
    </div>
  );
}
