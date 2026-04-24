import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

// ============================================================================
// Tipos
// ============================================================================

export interface BoardItem {
  id: string;
  board_id: string;
  stage_id: string;
  contact_id: string;
  ordem: number;
  moved_at: string;
  created_at: string;
}

/** Item do board com o contato embutido (join). */
export interface BoardItemWithContact extends BoardItem {
  contact: {
    id: string;
    nome: string;
    instagram: string | null;
    twitter: string | null;
    tiktok: string | null;
    youtube: string | null;
    whatsapp: string | null;
    telefone: string | null;
    email: string | null;
    is_favorite: boolean | null;
    leader_id: string | null;
  } | null;
}

// ============================================================================
// Queries
// ============================================================================

export function useBoardItems(boardId: string | null | undefined) {
  return useQuery<BoardItemWithContact[]>({
    queryKey: ['board_items', boardId],
    queryFn: async () => {
      if (!boardId) return [];

      const { data, error } = await supabase
        .from('board_items')
        .select(
          `
          id, board_id, stage_id, contact_id, ordem, moved_at, created_at,
          contact:contacts(id, nome, instagram, twitter, tiktok, youtube, whatsapp, telefone, email, is_favorite, leader_id)
        `
        )
        .eq('board_id', boardId)
        .order('stage_id', { ascending: true })
        .order('ordem', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as BoardItemWithContact[];
    },
    enabled: !!boardId,
  });
}

/** Conta quantos items existem em cada stage de um board. */
export function useBoardItemCounts(boardId: string | null | undefined) {
  return useQuery<Record<string, number>>({
    queryKey: ['board_items', 'counts', boardId],
    queryFn: async () => {
      if (!boardId) return {};
      const { data, error } = await supabase
        .from('board_items')
        .select('stage_id')
        .eq('board_id', boardId);

      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.stage_id] = (counts[row.stage_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: !!boardId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useAddContactToBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      board_id,
      stage_id,
      contact_id,
    }: {
      board_id: string;
      stage_id: string;
      contact_id: string;
    }) => {
      // Descobrir próxima ordem dentro do stage
      const { count } = await supabase
        .from('board_items')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stage_id);

      const { data, error } = await supabase
        .from('board_items')
        .insert({
          board_id,
          stage_id,
          contact_id,
          ordem: count ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BoardItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['board_items', data.board_id] });
      toast.success('Contato adicionado ao funil');
      logActivity({
        type: 'create',
        entity_type: 'board_item',
        entity_id: data.id,
        description: 'Adicionou contato ao funil',
      });
    },
    onError: (error: Error) => {
      const msg = error.message.includes('duplicate key')
        ? 'Esse contato já está neste funil'
        : error.message;
      toast.error(`Erro ao adicionar contato: ${msg}`);
    },
  });
}

/**
 * Move um board_item para outro stage (ou reordena dentro do mesmo).
 * Atualiza `moved_at` para agora — usado pelo indicador "parado há X dias".
 */
export function useMoveBoardItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      newStageId,
      newOrdem,
    }: {
      itemId: string;
      newStageId: string;
      newOrdem?: number;
    }) => {
      const patch: { stage_id: string; moved_at: string; ordem?: number } = {
        stage_id: newStageId,
        moved_at: new Date().toISOString(),
      };
      if (newOrdem !== undefined) patch.ordem = newOrdem;

      const { data, error } = await supabase
        .from('board_items')
        .update(patch)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data as BoardItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['board_items', data.board_id] });
      // NÃO dar toast a cada drag — muito barulho
    },
    onError: (error: Error) => {
      toast.error(`Erro ao mover: ${error.message}`);
    },
  });
}

export function useRemoveBoardItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data: existing } = await supabase
        .from('board_items')
        .select('board_id')
        .eq('id', itemId)
        .single();

      const { error } = await supabase.from('board_items').delete().eq('id', itemId);
      if (error) throw error;

      return existing as { board_id: string } | null;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['board_items', data.board_id] });
      }
      toast.success('Contato removido do funil');
      logActivity({
        type: 'delete',
        entity_type: 'board_item',
        description: 'Removeu contato do funil',
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });
}
