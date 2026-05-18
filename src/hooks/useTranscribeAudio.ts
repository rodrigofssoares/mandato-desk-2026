// Hook: useTranscribeAudio
//
// Chama a EF zapi-transcribe-audio para uma mensagem específica.
// Invalida a query de mensagens do chat após sucesso para exibir a transcrição.
//
// Referência: RAQ-MAND-EM073 — T84 (Fase 7 Onda A)

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TranscribeResult {
  transcription?: string;
  message_id?: string;
  cached?: boolean;
  skipped?: boolean;
  /** Motivo do skip: 'provider_unsupported' | 'features_disabled' | 'ai_disabled' | etc. */
  reason?: string;
  /** Mensagem amigável para exibição ao usuário (presente quando reason = 'provider_unsupported') */
  message?: string;
  error?: string;
}

export function useTranscribeAudio(chatId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<TranscribeResult, Error, { messageId: string; accountId: string }>({
    mutationFn: async ({ messageId, accountId }) => {
      const { data, error } = await supabase.functions.invoke('zapi-transcribe-audio', {
        body: { message_id: messageId, account_id: accountId },
      });

      if (error) throw new Error(error.message);
      return (data as TranscribeResult) ?? {};
    },
    onSuccess: () => {
      // Invalida mensagens do chat para exibir a transcrição na UI
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: ['zapi-messages', chatId] });
      }
    },
  });
}
