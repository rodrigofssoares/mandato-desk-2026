import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Tipos
// ============================================================================

export interface FunnelReportStage {
  stage_id: string;
  nome: string;
  cor: string | null;
  count: number;
  /** null = primeiro estágio selecionado (renderizar como "—") */
  pctVsAnterior: number | null;
  /** null = topo do funil tem 0 contatos (divisão por zero — renderizar como "N/A") */
  pctVsTopo: number | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Busca estágios do funil selecionado com contagem de contatos e cálculo de
 * percentuais de conversão (vs. anterior e vs. topo).
 *
 * @param boardId   ID do board (funil) selecionado. Null retorna array vazio.
 * @param selectedStageIds IDs dos estágios selecionados no multi-select.
 *                         Array vazio retorna array vazio sem query.
 */
export interface FunnelReportResult {
  data: FunnelReportStage[];
  isLoading: boolean;
  error: Error | null;
  /** true quando o board tem > 10.000 contatos e o relatório exibe apenas os primeiros 10k */
  truncado: boolean;
  /** total de contatos no board (incluindo os não carregados quando truncado=true) */
  totalContatos: number;
}

export function useFunnelReport(
  boardId: string | null,
  selectedStageIds: string[]
): FunnelReportResult {
  const enabled = !!boardId && selectedStageIds.length > 0;

  const query = useQuery<{ stages: FunnelReportStage[]; truncado: boolean; totalContatos: number }>({
    queryKey: ['funnel-report', boardId, selectedStageIds],
    enabled,
    queryFn: async () => {
      if (!boardId) return { stages: [], truncado: false, totalContatos: 0 };

      // Busca todos os estágios do board na ordem definida
      const { data: stagesData, error: stagesErr } = await supabase
        .from('board_stages')
        .select('id, nome, cor, ordem')
        .eq('board_id', boardId)
        .order('ordem', { ascending: true });

      if (stagesErr) throw stagesErr;

      // Busca items do board com count exato para detectar truncamento
      // Limite de 10k itens — boards maiores exibirão banner de aviso
      const { data: itemsData, error: itemsErr, count } = await supabase
        .from('board_items')
        .select('stage_id', { count: 'exact' })
        .eq('board_id', boardId)
        .range(0, 9999);

      if (itemsErr) throw itemsErr;

      const totalRecuperado = itemsData?.length ?? 0;
      const totalExistente = count ?? totalRecuperado;
      const truncado = totalRecuperado < totalExistente;

      // Monta mapa de contagens por stage_id
      const counts: Record<string, number> = {};
      for (const row of itemsData ?? []) {
        counts[row.stage_id] = (counts[row.stage_id] ?? 0) + 1;
      }

      // Filtra apenas os estágios selecionados, mantendo a ordem original do board
      const selectedSet = new Set(selectedStageIds);
      const filtered = (stagesData ?? []).filter((s) => selectedSet.has(s.id));

      // Calcula percentuais de conversão
      const topoCount = filtered.length > 0 ? (counts[filtered[0].id] ?? 0) : 0;

      const result: FunnelReportStage[] = filtered.map((s, index) => {
        const stageCount = counts[s.id] ?? 0;
        const anterior = index > 0 ? (counts[filtered[index - 1].id] ?? 0) : null;

        let pctVsAnterior: number | null = null;
        if (anterior !== null) {
          pctVsAnterior = anterior === 0 ? null : (stageCount / anterior) * 100;
        }

        const pctVsTopo: number | null =
          topoCount === 0 ? null : (stageCount / topoCount) * 100;

        return {
          stage_id: s.id,
          nome: s.nome,
          cor: s.cor,
          count: stageCount,
          pctVsAnterior,
          pctVsTopo,
        };
      });

      return { stages: result, truncado, totalContatos: totalExistente };
    },
  });

  if (!enabled) {
    return { data: [], isLoading: false, error: null, truncado: false, totalContatos: 0 };
  }

  return {
    data: query.data?.stages ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    truncado: query.data?.truncado ?? false,
    totalContatos: query.data?.totalContatos ?? 0,
  };
}
