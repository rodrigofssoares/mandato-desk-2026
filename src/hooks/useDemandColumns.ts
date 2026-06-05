// useDemandColumns.ts — RAQ-MAND-EM085
// Colunas configuráveis do kanban de Demandas. Reaproveita a infra de
// boards/board_stages (board singleton com tipo_entidade='demand').
//
// As mutations de criar/renomear/cor/reordenar são as mesmas de useBoardStages
// (operam em board_stages). Aqui adicionamos:
//   - useDemandBoardId(): id do board singleton de demandas
//   - useDemandStageCounts(): nº de demandas por coluna (stage_id)
//   - useDeleteDemandColumn(): exclusão "demand-aware" (bloqueia se houver demandas)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

export {
  useBoardStages as useDemandStages,
  useCreateBoardStage as useCreateDemandColumn,
  useUpdateBoardStage as useUpdateDemandColumn,
  useReorderBoardStages as useReorderDemandColumns,
  type BoardStage as DemandColumn,
} from './useBoardStages';

/** Id do board singleton de demandas (criado pela migration 113). */
export function useDemandBoardId() {
  return useQuery<string | null>({
    queryKey: ['demand-board-id'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boards')
        .select('id')
        .eq('tipo_entidade', 'demand')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Contagem de demandas por coluna (stage_id) → { [stageId]: total }.
 * Premissa: existe um único board de demandas (singleton criado pela mig 113).
 * Se um dia houver múltiplos boards 'demand', restringir por board_id.
 */
export function useDemandStageCounts() {
  return useQuery<Record<string, number>>({
    queryKey: ['demand-stage-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('demands').select('stage_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{ stage_id: string | null }>) {
        if (row.stage_id) counts[row.stage_id] = (counts[row.stage_id] ?? 0) + 1;
      }
      return counts;
    },
  });
}

/**
 * Exclui uma coluna do kanban de demandas, bloqueando se ainda houver demandas
 * posicionadas nela (evita "perder" demandas — o FK é ON DELETE SET NULL).
 */
export function useDeleteDemandColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stageId: string) => {
      // Nota: count + delete não são atômicos. O FK ON DELETE SET NULL garante
      // que nenhuma demanda é perdida mesmo numa corrida; o check é só p/ UX.
      const { count, error: countError } = await supabase
        .from('demands')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stageId);
      if (countError) throw countError;

      if ((count ?? 0) > 0) {
        throw new Error(
          `Esta coluna contém ${count} demanda(s). Mova-as para outra coluna antes de excluir.`,
        );
      }

      const { data: existing } = await supabase
        .from('board_stages')
        .select('board_id, nome')
        .eq('id', stageId)
        .single();

      const { error } = await supabase.from('board_stages').delete().eq('id', stageId);
      if (error) throw error;
      return existing;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['board_stages', data?.board_id] });
      queryClient.invalidateQueries({ queryKey: ['demand-stage-counts'] });
      toast.success('Coluna excluída');
      logActivity({
        type: 'delete',
        entity_type: 'board_stage',
        entity_name: data?.nome ?? undefined,
        description: 'Excluiu uma coluna de demandas',
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir coluna: ${error.message}`);
    },
  });
}
