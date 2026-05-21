import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FAVORITES_LIMIT } from '@/hooks/useAgentFavorites';

// ============================================================================
// Hook: useToggleFavorite
// ============================================================================

/**
 * Toggle favorito de uma mensagem assistant.
 * Antes de criar, valida limite de 500 via contagem no cache.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation<
    { action: 'added' | 'removed'; favoriteId?: string },
    Error,
    { message_id: string; favorite_id?: string | null }
  >({
    mutationFn: async ({ message_id, favorite_id }) => {
      // Se já é favorito, remove
      if (favorite_id) {
        const { error } = await supabase
          .from('ai_chat_favorites' as never)
          .delete()
          .eq('id', favorite_id as never);

        if (error) throw error;
        return { action: 'removed' };
      }

      // Valida limite via cache antes de criar
      const cached = queryClient.getQueryData<{ data: unknown[]; count: number; limit: number }>(
        ['agent-favorites']
      );
      const currentCount = cached?.count ?? 0;

      if (currentCount >= FAVORITES_LIMIT) {
        throw new Error(`Limite de ${FAVORITES_LIMIT} favoritos atingido. Remova alguns antes de adicionar novos.`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('ai_chat_favorites' as never)
        .insert({ user_id: user.id, message_id } as never)
        .select('id')
        .single();

      if (error) throw error;
      const row = data as Record<string, unknown>;
      return { action: 'added', favoriteId: row.id as string };
    },

    onSuccess: ({ action }) => {
      queryClient.invalidateQueries({ queryKey: ['agent-favorites'] });
      if (action === 'added') {
        toast.success('Adicionado às favoritas');
      } else {
        toast.success('Removido das favoritas');
      }
    },

    onError: (err) => {
      toast.error(err.message);
    },
  });
}

// ============================================================================
// Hook: useUpdateFavoriteNote
// ============================================================================

/**
 * Atualiza a nota de um favorito. Máximo 200 caracteres.
 */
export function useUpdateFavoriteNote() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { favoriteId: string; note: string }>({
    mutationFn: async ({ favoriteId, note }) => {
      const truncated = note.trim().slice(0, 200);

      const { error } = await supabase
        .from('ai_chat_favorites' as never)
        .update({ note: truncated || null } as never)
        .eq('id', favoriteId as never);

      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-favorites'] });
      toast.success('Nota salva');
    },

    onError: (err) => {
      toast.error(`Erro ao salvar nota: ${err.message}`);
    },
  });
}
