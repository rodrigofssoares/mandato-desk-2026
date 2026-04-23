import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

// ============================================================================
// Tipos
// ============================================================================

export interface Board {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_entidade: 'contact' | 'demand' | 'leader';
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardInsert {
  nome: string;
  descricao?: string | null;
  tipo_entidade?: 'contact' | 'demand' | 'leader';
  is_default?: boolean;
}

export interface BoardUpdate {
  id: string;
  patch: Partial<Omit<BoardInsert, 'tipo_entidade'>>;
}

// ============================================================================
// Queries
// ============================================================================

export function useBoards(tipoEntidade: 'contact' | 'demand' | 'leader' = 'contact') {
  return useQuery<Board[]>({
    queryKey: ['boards', tipoEntidade],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('tipo_entidade', tipoEntidade)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as Board[];
    },
  });
}

export function useBoardDetail(boardId: string | null | undefined) {
  return useQuery<Board | null>({
    queryKey: ['boards', 'detail', boardId],
    queryFn: async () => {
      if (!boardId) return null;
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('id', boardId)
        .maybeSingle();

      if (error) throw error;
      return data as Board | null;
    },
    enabled: !!boardId,
  });
}

export function useDefaultBoard(tipoEntidade: 'contact' | 'demand' | 'leader' = 'contact') {
  return useQuery<Board | null>({
    queryKey: ['boards', 'default', tipoEntidade],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('tipo_entidade', tipoEntidade)
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      return data as Board | null;
    },
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useCreateBoard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: BoardInsert) => {
      const nome = input.nome.trim();
      if (!nome) throw new Error('Nome do funil é obrigatório');

      // Se marcado como default, desmarcar os outros do mesmo tipo
      if (input.is_default) {
        await supabase
          .from('boards')
          .update({ is_default: false })
          .eq('tipo_entidade', input.tipo_entidade ?? 'contact')
          .eq('is_default', true);
      }

      const { data, error } = await supabase
        .from('boards')
        .insert({
          nome,
          descricao: input.descricao ?? null,
          tipo_entidade: input.tipo_entidade ?? 'contact',
          is_default: input.is_default ?? false,
          created_by: user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Board;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success(`Funil "${data.nome}" criado`);
      logActivity({
        type: 'create',
        entity_type: 'board',
        entity_id: data.id,
        entity_name: data.nome,
        description: `Criou o funil "${data.nome}"`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar funil: ${error.message}`);
    },
  });
}

export function useUpdateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: BoardUpdate) => {
      // Se marcou como default, desmarcar outros do mesmo tipo
      if (patch.is_default) {
        const { data: atual } = await supabase
          .from('boards')
          .select('tipo_entidade')
          .eq('id', id)
          .single();

        if (atual) {
          await supabase
            .from('boards')
            .update({ is_default: false })
            .eq('tipo_entidade', atual.tipo_entidade)
            .eq('is_default', true)
            .neq('id', id);
        }
      }

      const { data, error } = await supabase
        .from('boards')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Board;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success('Funil atualizado');
      logActivity({
        type: 'update',
        entity_type: 'board',
        entity_id: data.id,
        entity_name: data.nome,
        description: `Atualizou o funil "${data.nome}"`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar funil: ${error.message}`);
    },
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Buscar dados antes para o log
      const { data: board } = await supabase
        .from('boards')
        .select('nome')
        .eq('id', id)
        .single();

      const { error } = await supabase.from('boards').delete().eq('id', id);
      if (error) throw error;

      return { id, nome: board?.nome ?? 'board' };
    },
    onSuccess: ({ id, nome }) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      queryClient.invalidateQueries({ queryKey: ['board_stages'] });
      queryClient.invalidateQueries({ queryKey: ['board_items'] });
      toast.success(`Funil "${nome}" excluído`);
      logActivity({
        type: 'delete',
        entity_type: 'board',
        entity_id: id,
        entity_name: nome,
        description: `Excluiu o funil "${nome}"`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir funil: ${error.message}`);
    },
  });
}
