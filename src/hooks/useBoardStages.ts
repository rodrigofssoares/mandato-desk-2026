import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

// ============================================================================
// Tipos
// ============================================================================

export interface BoardStage {
  id: string;
  board_id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardStageInsert {
  board_id: string;
  nome: string;
  cor?: string | null;
  ordem?: number;
}

// ============================================================================
// Queries
// ============================================================================

export function useBoardStages(boardId: string | null | undefined) {
  return useQuery<BoardStage[]>({
    queryKey: ['board_stages', boardId],
    queryFn: async () => {
      if (!boardId) return [];
      const { data, error } = await supabase
        .from('board_stages')
        .select('*')
        .eq('board_id', boardId)
        .order('ordem', { ascending: true });

      if (error) throw error;
      return (data ?? []) as BoardStage[];
    },
    enabled: !!boardId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useCreateBoardStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BoardStageInsert) => {
      const nome = input.nome.trim();
      if (!nome) throw new Error('Nome do estágio é obrigatório');

      // Descobrir próxima ordem se não informada
      let ordem = input.ordem;
      if (ordem === undefined) {
        const { count } = await supabase
          .from('board_stages')
          .select('*', { count: 'exact', head: true })
          .eq('board_id', input.board_id);
        ordem = count ?? 0;
      }

      const { data, error } = await supabase
        .from('board_stages')
        .insert({
          board_id: input.board_id,
          nome,
          cor: input.cor ?? null,
          ordem,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BoardStage;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['board_stages', data.board_id] });
      toast.success(`Estágio "${data.nome}" criado`);
      logActivity({
        type: 'create',
        entity_type: 'board_stage',
        entity_id: data.id,
        entity_name: data.nome,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar estágio: ${error.message}`);
    },
  });
}

export function useUpdateBoardStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<BoardStage, 'nome' | 'cor' | 'ordem'>>;
    }) => {
      const { data, error } = await supabase
        .from('board_stages')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BoardStage;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['board_stages', data.board_id] });
      toast.success('Estágio atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar estágio: ${error.message}`);
    },
  });
}

export function useDeleteBoardStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Bloqueia se tiver items
      const { count } = await supabase
        .from('board_items')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', id);

      if ((count ?? 0) > 0) {
        throw new Error(
          `Este estágio contém ${count} contato(s). Mova-os para outro estágio antes.`
        );
      }

      const { data: existing } = await supabase
        .from('board_stages')
        .select('board_id, nome')
        .eq('id', id)
        .single();

      const { error } = await supabase.from('board_stages').delete().eq('id', id);
      if (error) throw error;
      return existing;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['board_stages', data?.board_id] });
      toast.success('Estágio excluído');
      logActivity({
        type: 'delete',
        entity_type: 'board_stage',
        entity_name: data?.nome ?? undefined,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir estágio: ${error.message}`);
    },
  });
}

/**
 * Reordena estágios de um board em uma única operação.
 * Recebe o array de IDs na nova ordem desejada; faz um UPDATE por estágio
 * atualizando apenas o campo `ordem`. Supabase não tem batch update nativo
 * por linha, mas as atualizações são paralelizáveis.
 */
export function useReorderBoardStages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      boardId,
      orderedIds,
    }: {
      boardId: string;
      orderedIds: string[];
    }) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from('board_stages').update({ ordem: index }).eq('id', id)
      );

      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;

      return { boardId, count: orderedIds.length };
    },
    onSuccess: ({ boardId }) => {
      queryClient.invalidateQueries({ queryKey: ['board_stages', boardId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reordenar estágios: ${error.message}`);
    },
  });
}
