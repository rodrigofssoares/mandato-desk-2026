import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, BarChart2, RefreshCw } from 'lucide-react';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const urlBoardId = searchParams.get('board');

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(urlBoardId);
  const [selectedBoardNome, setSelectedBoardNome] = useState<string>('');
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>([]);
  const [chartType, setChartType] = useState<ReportChartViewType>('bar-horizontal');

  // Sincroniza seleção atual de funil com a URL para que o link "voltar" e o
  // compartilhamento de URL preservem o contexto.
  useEffect(() => {
    const current = searchParams.get('board');
    if (selectedBoardId && selectedBoardId !== current) {
      const next = new URLSearchParams(searchParams);
      next.set('board', selectedBoardId);
      setSearchParams(next, { replace: true });
    } else if (!selectedBoardId && current) {
      const next = new URLSearchParams(searchParams);
      next.delete('board');
      setSearchParams(next, { replace: true });
    }
  }, [selectedBoardId, searchParams, setSearchParams]);

  // Ref para o container do gráfico — usado na captura SVG do PDF
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { data: stages = [], isLoading, truncado } = useFunnelReport(selectedBoardId, selectedStageIds);

  const handleBoardChange = useCallback(
    (boardId: string | null, boardNome?: string) => {
      setSelectedBoardId(boardId);
      setSelectedBoardNome(boardNome ?? '');
    },
    []
  );

  const handleStageIdsChange = useCallback((ids: string[]) => {
    setSelectedStageIds(ids);
  }, []);

  function handleAtualizar() {
    queryClient.invalidateQueries({ queryKey: ['funnel-report', selectedBoardId] });
    toast.success('Dados atualizados');
  }

  // Guard RBAC — usar mesmo padrão de acesso negado
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
              disabled={!selectedBoardId || isLoading}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Atualizar
            </Button>
            <ExportMenu
              stages={stages}
              boardNome={selectedBoardNome}
              isLoading={isLoading}
              chartContainerRef={chartContainerRef.current}
            />
          </div>
        }
      >
        {/* Seletor de funil e estágios — escondido na impressão */}
        <div className="print:hidden">
          <FunnelSelector
            selectedBoardId={selectedBoardId}
            selectedStageIds={selectedStageIds}
            onBoardChange={handleBoardChange}
            onStageIdsChange={handleStageIdsChange}
          />
        </div>
      </PageHeader>

      {/* Banner de truncamento — exibido quando board tem > 10k contatos */}
      {truncado && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Atenção: este funil tem mais de 10.000 contatos. O relatório exibe apenas os 10.000
            primeiros — valores podem estar incompletos.
          </span>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="grid grid-cols-1 gap-6">
        {/* Gráfico */}
        <FunnelReportChart
          ref={chartContainerRef}
          stages={stages}
          isLoading={isLoading}
          viewType={chartType}
          onChangeViewType={setChartType}
          hasSelection={selectedStageIds.length > 0}
        />

        {/* Tabela de métricas */}
        <FunnelMetricsTable
          stages={stages}
          isLoading={isLoading}
          hasSelection={selectedStageIds.length > 0}
        />
      </div>
    </div>
  );
}
