// Hook: useAISuggestReply
//
// Chama a EF zapi-ai-suggest-reply e retorna sugestão de resposta efêmera.
// Usado pelo compositor de mensagens em ConversasTabContent (T82).
//
// Referência: RAQ-MAND-EM073 — T82 (Fase 7 Onda A)

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SuggestReplyResult {
  suggestion?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
  message?: string;
}

export function useAISuggestReply(chatId: string | null, accountId: string | null) {
  return useMutation<SuggestReplyResult, Error, void>({
    mutationFn: async () => {
      if (!chatId || !accountId) throw new Error('chatId e accountId são obrigatórios');

      const { data, error } = await supabase.functions.invoke('zapi-ai-suggest-reply', {
        body: { chat_id: chatId, account_id: accountId },
      });

      if (error) throw new Error(error.message);
      return (data as SuggestReplyResult) ?? {};
    },
  });
}
