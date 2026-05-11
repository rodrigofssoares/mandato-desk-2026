import { useState } from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui-system/PageHeader';
import { usePermissions } from '@/hooks/usePermissions';
import { FunnelSelector } from '@/components/relatorios/FunnelSelector';
import { FunnelMetricsTable } from '@/components/relatorios/FunnelMetricsTable';
import { FunnelReportChart } from '@/components/relatorios/FunnelChart';
import { ExportMenu } from '@/components/relatorios/ExportMenu';
import { useFunnelReport } from '@/hooks/useFunnelReport';
import type { ReportChartViewType } from '@/lib/relatorios';

export default function Relatorios() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedBoardNome, setSelectedBoardNome] = useState<string>('');
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>([]);
  const [chartType, setChartType] = useState<ReportChartViewType>('bar-horizontal');

  const { data: stages = [], isLoading } = useFunnelReport(selectedBoardId, selectedStageIds);

  if (!can.exportData()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
        <BarChart2 className="h-12 w-12 text-muted-foreground/40" />
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Você não tem permissão para acessar a página de Relatórios.
          Entre em contato com o administrador do gabinete.
        </p>
      </div>
    );
  }

  function handleAtualizar() {
    queryClient.invalidateQueries({ queryKey: ['funnel-report', selectedBoardId] });
    toast.success('Dados atualizados');
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Análise"
        title="Relatórios"
        description="Análise de conversão dos funis de mobilização"
        icon={BarChart2}
        iconVariant="primary"
        actions={
          <div className="print:hidden flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAtualizar}
              disabled={!selectedBoardId}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Atualizar
            </Button>
            <ExportMenu
              stages={stages}
              boardNome={selectedBoardNome}
              isLoading={isLoading}
            />
          </div>
        }
      >
        {/* Seletor de funil e estágios */}
        <div className="print:hidden">
          <FunnelSelector
            selectedBoardId={selectedBoardId}
            selectedStageIds={selectedStageIds}
            onBoardChange={(boardId, boardNome) => {
              setSelectedBoardId(boardId);
              setSelectedBoardNome(boardNome ?? '');
            }}
            onStageIdsChange={setSelectedStageIds}
          />
        </div>
      </PageHeader>

      {/* Conteúdo principal */}
      <div className="grid grid-cols-1 gap-6">
        {/* Gráfico */}
        <FunnelReportChart
          stages={stages}
          isLoading={isLoading}
          viewType={chartType}
          onChangeViewType={setChartType}
          hasSelection={selectedStageIds.length > 0}
        />

        {/* Tabela de métricas */}
        <FunnelMetricsTable stages={stages} isLoading={isLoading} />
      </div>
    </div>
  );
}
