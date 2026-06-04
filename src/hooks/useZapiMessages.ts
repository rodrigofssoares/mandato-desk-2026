import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type ZapiMessage = Tables<'zapi_messages'>;

// ─── Key Factory ────────────────────────────────────────────────────────────

export const zapiMessageKeys = {
  all: ['zapi-messages'] as const,
  byChat: (chatId: string | null) => ['zapi-messages', chatId] as const,
};

export interface SendZapiMessageInput {
  account_id: string;
  /** Telefone do destinatário em qualquer formato — a EF normaliza. */
  phone: string;
  /** Texto da mensagem (1 a 4096 caracteres após trim). */
  message: string;
  /** T33: ID Z-API da mensagem a citar (reply). Opcional. */
  quoted_message_id?: string;
}

export interface SendZapiMessageResult {
  ok: true;
  message_id: string;
  chat_id: string;
}

interface SendZapiMessageError {
  error: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normaliza erros vindos da EF zapi-send-text. A EF já retorna
 * mensagens prontas pra UI — aqui só extraímos do envelope `{ error }`.
 */
function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const inner = (err as SendZapiMessageError).error;
    if (typeof inner === 'string' && inner.length > 0) return inner;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

// ─── useSendZapiMessage ────────────────────────────────────────────────────

/**
 * Envia uma mensagem de texto via Z-API.
 *
 * Fluxo:
 *   - Invoca a Edge Function `zapi-send-text` (auth via Authorization header
 *     injetado pelo supabase-js).
 *   - Em sucesso, invalida queryKeys de chats/messages pra refletir o novo
 *     histórico se o usuário entrar na aba Conversas em seguida.
 *   - Não bloqueia em caso de erro de persistência da EF — a EF já loga.
 *
 * Pattern: react-query mutation. Invalidação otimista pode ser adicionada
 * quando T07 (useZapiChats/Messages) entrar em produção.
 */
export function useSendZapiMessage() {
  const queryClient = useQueryClient();

  return useMutation<SendZapiMessageResult, Error, SendZapiMessageInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke<
        SendZapiMessageResult | SendZapiMessageError
      >('zapi-send-text', {
        body: input,
      });

      if (error) {
        // supabase.functions.invoke joga o body do erro em error.context
        // quando a EF retorna 4xx/5xx. Tentamos extrair pra mostrar a msg da EF.
        const ctx = (error as unknown as { context?: { json?: () => Promise<unknown> } }).context;
        if (ctx?.json) {
          try {
            const errBody = await ctx.json();
            throw new Error(extractErrorMessage(errBody, error.message));
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr;
          }
        }
        throw new Error(error.message || 'Falha ao enviar mensagem');
      }

      if (!data || 'error' in data) {
        throw new Error(extractErrorMessage(data, 'Resposta inválida da Edge Function'));
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalida pra que ao abrir a aba Conversas o histórico já apareça
      queryClient.invalidateQueries({ queryKey: ['zapi-chats'] });
      queryClient.invalidateQueries({ queryKey: ['zapi-messages', data.chat_id] });
      toast.success('Mensagem enviada');
    },
    onError: (err) => {
      toast.error(err.message || 'Erro ao enviar mensagem');
    },
  });
}

// ─── useZapiMessagesByChat ─────────────────────────────────────────────────

/**
 * Lista mensagens de um chat em ordem cronológica ascendente (mais antiga
 * primeiro — pra renderizar de cima pra baixo no scroll).
 *
 * Sincronização em duas camadas (belt-and-suspenders):
 *   1. Realtime (instantâneo): subscribe em INSERT/UPDATE em zapi_messages
 *      filtrando por chat_id, invalida a query a cada evento. Cleanup no unmount.
 *   2. Polling de fallback (refetchInterval): o Realtime postgres_changes é
 *      best-effort e pode perder eventos sob carga (já houve apagão por
 *      sobrecarga no projeto). Sem fallback, mensagens recebidas via webhook só
 *      apareciam após refresh manual. O polling garante que a conversa aberta
 *      sincronize em no máximo POLL_INTERVAL_MS mesmo se o Realtime falhar.
 *      Só a conversa ATIVA poleia (o hook só monta pra ela) e nunca em
 *      background — carga negligenciável (query indexada por chat_id).
 *
 * Quando chatId é null/undefined retorna [] sem query.
 */
const POLL_INTERVAL_MS = 4_000;

export function useZapiMessagesByChat(chatId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: zapiMessageKeys.byChat(chatId ?? null),
    enabled: !!chatId,
    // Fallback de sincronização — complementa o Realtime, não o substitui.
    // O ternário é redundante com `enabled` (sem chatId não há poll), mas
    // mantido explícito pra deixar a intenção clara na leitura.
    refetchInterval: chatId ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<ZapiMessage[]> => {
      // EM082: filtrar mensagens na lixeira (soft-delete)
      const { data, error } = await supabase
        .from('zapi_messages')
        .select('*')
        .eq('chat_id', chatId!)
        .is('deleted_at', null)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ZapiMessage[];
    },
  });

  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`zapi-messages-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zapi_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: zapiMessageKeys.byChat(chatId) });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, queryClient]);

  return query;
}
