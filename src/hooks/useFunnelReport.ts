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
export function useFunnelReport(
  boardId: string | null,
  selectedStageIds: string[]
): { data: FunnelReportStage[]; isLoading: boolean; error: Error | null } {
  const enabled = !!boardId && selectedStageIds.length > 0;

  const query = useQuery<FunnelReportStage[]>({
    queryKey: ['funnel-report', boardId, selectedStageIds],
    enabled,
    queryFn: async () => {
      if (!boardId) return [];

      // Busca todos os estágios do board na ordem definida
      const { data: stagesData, error: stagesErr } = await supabase
        .from('board_stages')
        .select('id, nome, cor, ordem')
        .eq('board_id', boardId)
        .order('ordem', { ascending: true });

      if (stagesErr) throw stagesErr;

      // Busca todos os items do board para contar por stage_id
      const { data: itemsData, error: itemsErr } = await supabase
        .from('board_items')
        .select('stage_id')
        .eq('board_id', boardId);

      if (itemsErr) throw itemsErr;

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
        const count = counts[s.id] ?? 0;
        const anterior = index > 0 ? (counts[filtered[index - 1].id] ?? 0) : null;

        let pctVsAnterior: number | null = null;
        if (anterior !== null) {
          pctVsAnterior = anterior === 0 ? null : (count / anterior) * 100;
        }

        const pctVsTopo: number | null =
          topoCount === 0 ? null : (count / topoCount) * 100;

        return {
          stage_id: s.id,
          nome: s.nome,
          cor: s.cor,
          count,
          pctVsAnterior,
          pctVsTopo,
        };
      });

      return result;
    },
  });

  if (!enabled) {
    return { data: [], isLoading: false, error: null };
  }

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
