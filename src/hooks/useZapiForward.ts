// Hook: useZapiForward
//
// Encaminha mensagem entre conversas via EF zapi-forward-message.
// T37 — Fase 4 (Interações nativas do WhatsApp)

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ForwardMessageInput {
  account_id: string;
  source_message_id: string;
  destination_phone: string;
}

interface ForwardMessageResult {
  ok: true;
}

interface ForwardMessageError {
  error: string;
}

function extractError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const inner = (err as ForwardMessageError).error;
    if (typeof inner === 'string' && inner.length > 0) return inner;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

/**
 * Hook para encaminhar uma mensagem para outro número.
 */
export function useForwardMessage() {
  return useMutation<ForwardMessageResult, Error, ForwardMessageInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke<
        ForwardMessageResult | ForwardMessageError
      >('zapi-forward-message', { body: input });

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
        throw new Error(error.message || 'Falha ao encaminhar mensagem');
      }

      if (!data || 'error' in data) {
        throw new Error(extractError(data, 'Resposta inválida da Edge Function'));
      }

      return data;
    },
    onSuccess: () => {
      toast.success('Mensagem encaminhada');
    },
    onError: (err) => {
      toast.error(err.message || 'Erro ao encaminhar mensagem');
    },
  });
}
