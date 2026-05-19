// Hook: useZapiReaction
//
// Envia reações a mensagens via EF zapi-send-reaction.
// T36 — Fase 4 (Interações nativas do WhatsApp)

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { zapiMessageKeys } from './useZapiMessages';

interface ReactToMessageInput {
  account_id: string;
  phone: string;
  message_id: string;
  reaction: string;
}

interface ReactToMessageResult {
  ok: true;
}

interface ReactToMessageError {
  error: string;
}

function extractError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const inner = (err as ReactToMessageError).error;
    if (typeof inner === 'string' && inner.length > 0) return inner;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

/**
 * Hook para enviar reação a uma mensagem.
 *
 * @param chatId - UUID do chat (para invalidar o cache após sucesso).
 */
export function useReactToMessage(chatId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation<ReactToMessageResult, Error, ReactToMessageInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke<
        ReactToMessageResult | ReactToMessageError
      >('zapi-send-reaction', { body: input });

      if (error) {
        const ctx = (error as unknown as { context?: { json?: () => Promise<unknown> } }).context;
        if (ctx?.json) {
          try {
            const errBody = await ctx.json();
            throw new Error(extractError(errBody, error.message));
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr;
          }
        }
        throw new Error(error.message || 'Falha ao enviar reação');
      }

      if (!data || 'error' in data) {
        throw new Error(extractError(data, 'Resposta inválida da Edge Function'));
      }

      return data;
    },
    onSuccess: () => {
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: zapiMessageKeys.byChat(chatId) });
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Erro ao enviar reação');
    },
  });
}
