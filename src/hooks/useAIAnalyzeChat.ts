// Hook: useAIAnalyzeChat
//
// Chama a EF zapi-ai-analyze-chat e invalida o cache de chats após sucesso.
// Usado pelo AISummarySection para análise lazy ao abrir uma conversa.
//
// Referência: RAQ-MAND-EM073 — T80 (Fase 7 Onda A)

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { zapiChatKeys } from '@/hooks/useZapiChats';

export interface AIAnalysisResult {
  summary?: string | null;
  intent?: string | null;
  sentiment?: 'positivo' | 'neutro' | 'negativo' | 'urgente' | null;
  analyzed_at?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
  message?: string;
}

export function useAIAnalyzeChat(chatId: string | null, accountId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<AIAnalysisResult, Error, void>({
    mutationFn: async () => {
      if (!chatId || !accountId) throw new Error('chatId e accountId são obrigatórios');

      const { data, error } = await supabase.functions.invoke('zapi-ai-analyze-chat', {
        body: { chat_id: chatId, account_id: accountId },
      });

      if (error) throw new Error(error.message);
      return (data as AIAnalysisResult) ?? {};
    },
    onSuccess: (_data) => {
      // Invalida o cache de chats para que as novas colunas de IA apareçam
      if (accountId) {
        queryClient.invalidateQueries({ queryKey: zapiChatKeys.byAccount(accountId) });
      }
    },
  });
}
