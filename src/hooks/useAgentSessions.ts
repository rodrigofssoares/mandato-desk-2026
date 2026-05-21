import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================================================
// Tipos
// ============================================================================

export interface AgentSession {
  id: string;
  user_id: string;
  title: string | null;
  last_message_at: string | null;
  created_at: string;
  message_count?: number;
}

// ============================================================================
// Hook: useAgentSessions
// ============================================================================

/**
 * Lista as sessões de chat do usuário autenticado, ordenadas da mais recente.
 * RLS garante que cada usuário vê apenas as próprias sessões.
 * Retorna até as últimas 30.
 */
export function useAgentSessions() {
  return useQuery<AgentSession[]>({
    queryKey: ['agent-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_chat_sessions' as never)
        .select('id, user_id, title, last_message_at, created_at')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(30);

      if (error) throw error;

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row): AgentSession => ({
        id: row.id as string,
        user_id: row.user_id as string,
        title: (row.title ?? null) as string | null,
        last_message_at: (row.last_message_at ?? null) as string | null,
        created_at: row.created_at as string,
      }));
    },
    staleTime: 30 * 1000, // 30 segundos
  });
}

// ============================================================================
// Hook: useCreateAgentSession
// ============================================================================

/**
 * Cria uma nova sessão vazia. Retorna o ID da sessão criada.
 */
export function useCreateAgentSession() {
  const queryClient = useQueryClient();

  return useMutation<string, Error>({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('ai_chat_sessions' as never)
        .insert({ user_id: user.id } as never)
        .select('id')
        .single();

      if (error) throw error;
      const row = data as Record<string, unknown>;
      return row.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-sessions'] });
    },
    onError: (err) => {
      toast.error(`Erro ao criar sessão: ${err.message}`);
    },
  });
}

// ============================================================================
// Hook: useDeleteAgentSession
// ============================================================================

/**
 * Remove uma sessão e suas mensagens (cascata via ON DELETE CASCADE no banco).
 */
export function useDeleteAgentSession() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('ai_chat_sessions' as never)
        .delete()
        .eq('id', sessionId as never);

      if (error) throw error;
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['agent-sessions'] });
      queryClient.removeQueries({ queryKey: ['agent-messages', sessionId] });
      toast.success('Conversa excluída');
    },
    onError: (err) => {
      toast.error(`Erro ao excluir conversa: ${err.message}`);
    },
  });
}

// ============================================================================
// Hook: useRenameAgentSession
// ============================================================================

/**
 * Renomeia uma sessão. Título truncado em 60 caracteres.
 */
export function useRenameAgentSession() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { sessionId: string; title: string }>({
    mutationFn: async ({ sessionId, title }) => {
      const truncated = title.trim().slice(0, 60);
      const { error } = await supabase
        .from('ai_chat_sessions' as never)
        .update({ title: truncated } as never)
        .eq('id', sessionId as never);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-sessions'] });
    },
    onError: (err) => {
      toast.error(`Erro ao renomear: ${err.message}`);
    },
  });
}
