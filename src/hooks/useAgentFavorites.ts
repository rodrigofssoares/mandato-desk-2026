import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Tipos
// ============================================================================

export interface AgentFavorite {
  id: string;
  user_id: string;
  message_id: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  /** Conteúdo completo da mensagem (join com ai_chat_messages) */
  message_content: string | null;
}

export const FAVORITES_LIMIT = 500;

// ============================================================================
// Hook: useAgentFavorites
// ============================================================================

/**
 * Lista os favoritos do usuário autenticado, ordenados do mais recente ao
 * mais antigo, com join no conteúdo da mensagem original.
 *
 * RLS garante que cada usuário vê apenas os próprios favoritos.
 * Mutations (adicionar, editar nota, remover) vêm na Onda 4 (UI de favoritos).
 *
 * Retorna:
 * - `data`: lista de favoritos
 * - `count`: total de favoritos do usuário
 * - `limit`: 500 (constante de negócio)
 */
export function useAgentFavorites() {
  return useQuery<{ data: AgentFavorite[]; count: number; limit: number }>({
    queryKey: ['agent-favorites'],
    queryFn: async () => {
      // Busca favoritos + conteúdo da mensagem via join
      const { data, error, count } = await supabase
        .from('ai_chat_favorites' as never)
        .select(
          `
          id,
          user_id,
          message_id,
          note,
          created_at,
          updated_at,
          ai_chat_messages!inner (
            content
          )
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as Array<Record<string, unknown>>;

      const favorites = rows.map((row): AgentFavorite => {
        const msgJoin = row['ai_chat_messages'] as Record<string, unknown> | null;
        return {
          id: row.id as string,
          user_id: row.user_id as string,
          message_id: row.message_id as string,
          note: (row.note ?? null) as string | null,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          message_content: msgJoin ? (msgJoin.content as string) : null,
        };
      });

      return {
        data: favorites,
        count: count ?? favorites.length,
        limit: FAVORITES_LIMIT,
      };
    },
    staleTime: 60 * 1000, // 1 minuto
  });
}
