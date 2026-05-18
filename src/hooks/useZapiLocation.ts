// Hook: useZapiLocation
//
// Envia localização via EF zapi-send-location.
// T38 — Fase 4 (Interações nativas do WhatsApp)

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { zapiMessageKeys } from './useZapiMessages';

export interface SendLocationInput {
  account_id: string;
  phone: string;
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

interface SendLocationResult {
  ok: true;
  message_id: string;
  chat_id: string;
}

interface SendLocationError {
  error: string;
}

function extractError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const inner = (err as SendLocationError).error;
    if (typeof inner === 'string' && inner.length > 0) return inner;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

/**
 * Hook para enviar uma localização em uma conversa.
 */
export function useSendLocation() {
  const queryClient = useQueryClient();

  return useMutation<SendLocationResult, Error, SendLocationInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke<
        SendLocationResult | SendLocationError
      >('zapi-send-location', { body: input });

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
        throw new Error(error.message || 'Falha ao enviar localização');
      }

      if (!data || 'error' in data) {
        throw new Error(extractError(data, 'Resposta inválida da Edge Function'));
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['zapi-chats'] });
      queryClient.invalidateQueries({ queryKey: zapiMessageKeys.byChat(data.chat_id) });
      toast.success('Localização enviada');
    },
    onError: (err) => {
      toast.error(err.message || 'Erro ao enviar localização');
    },
  });
}
