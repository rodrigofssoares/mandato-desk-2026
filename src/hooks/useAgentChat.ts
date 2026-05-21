import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================================================
// Tipos
// ============================================================================

export interface AgentMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  model_used: string | null;
  tokens: number | null;
  cost_brl: number | null;
  created_at: string;
  /** Indica se esta mensagem foi favoritada pelo usuário atual (join local) */
  is_favorited?: boolean;
  /** ID do favorito associado (para toggle) */
  favorite_id?: string | null;
}

export interface SendMessageInput {
  session_id: string;
  message: string;
  model_id?: string;
}

export interface SendMessageResponse {
  reply: string;
  session_id: string;
  message_id: string;
  model_used: string;
  tokens: number;
  cost_brl: number;
}

// ============================================================================
// Hook: useAgentMessages
// ============================================================================

/**
 * Busca mensagens de uma sessão específica, ordenadas por created_at ASC.
 * Só dispara a query se sessionId for não-null.
 */
export function useAgentMessages(sessionId: string | null) {
  return useQuery<AgentMessage[]>({
    queryKey: ['agent-messages', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      if (!sessionId) return [];

      const { data, error } = await supabase
        .from('ai_chat_messages' as never)
        .select('id, session_id, role, content, model_used, tokens, cost_brl, created_at')
        .eq('session_id', sessionId as never)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row): AgentMessage => ({
        id: row.id as string,
        session_id: row.session_id as string,
        role: row.role as 'user' | 'assistant',
        content: row.content as string,
        model_used: (row.model_used ?? null) as string | null,
        tokens: (row.tokens ?? null) as number | null,
        cost_brl: (row.cost_brl ?? null) as number | null,
        created_at: row.created_at as string,
      }));
    },
    staleTime: 30 * 1000,
  });
}

// ============================================================================
// Hook: useSendAgentMessage
// ============================================================================

/**
 * Envia uma mensagem ao agente via Edge Function `ai-agent-chat`.
 *
 * Fluxo:
 * 1. Optimistic update: insere mensagem user no cache antes da resposta.
 * 2. Em sucesso: insere mensagem assistant + invalida queries.
 * 3. Em erro: reverte optimistic update + toast.
 */
export function useSendAgentMessage() {
  const queryClient = useQueryClient();

  return useMutation<SendMessageResponse, Error, SendMessageInput>({
    mutationFn: async ({ session_id, message, model_id }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');

      const body: Record<string, unknown> = { session_id, message };
      if (model_id) body.model_id = model_id;

      const response = await supabase.functions.invoke('ai-agent-chat', {
        body,
      });

      if (response.error) throw response.error;

      const result = response.data as SendMessageResponse;
      if (!result?.reply) throw new Error('Resposta inválida do agente');

      return result;
    },

    onMutate: async ({ session_id, message }) => {
      // Cancela queries pendentes
      await queryClient.cancelQueries({ queryKey: ['agent-messages', session_id] });

      // Snapshot das mensagens atuais
      const snapshot = queryClient.getQueryData<AgentMessage[]>(['agent-messages', session_id]);

      // Insere mensagem user otimisticamente
      const optimisticMsg: AgentMessage = {
        id: `optimistic-${Date.now()}`,
        session_id,
        role: 'user',
        content: message,
        model_used: null,
        tokens: null,
        cost_brl: null,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<AgentMessage[]>(
        ['agent-messages', session_id],
        (old) => [...(old ?? []), optimisticMsg]
      );

      return { snapshot, session_id };
    },

    onSuccess: (data, { session_id }) => {
      // Invalida para buscar mensagens reais do banco (user + assistant inseridos pela EF)
      queryClient.invalidateQueries({ queryKey: ['agent-messages', session_id] });
      queryClient.invalidateQueries({ queryKey: ['agent-sessions'] });
    },

    onError: (err, { session_id }, context) => {
      // Reverte otimistic update
      const ctx = context as { snapshot?: AgentMessage[]; session_id?: string } | undefined;
      if (ctx?.snapshot !== undefined) {
        queryClient.setQueryData(['agent-messages', session_id], ctx.snapshot);
      }
      toast.error(`Erro ao enviar mensagem: ${err.message}`);
    },
  });
}
