// Hook: useMessageFlags
//
// Gerencia favoritos de mensagens de um chat via zapi_chat_message_flags.
// T35 — Fase 4 (Interações nativas do WhatsApp)
//
// RLS da tabela garante que cada usuário só vê/gerencia os próprios favoritos.
// Escrita direta pelo client (sem EF) — RLS cobre segurança.

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type MessageFlag = Tables<'zapi_chat_message_flags'>;

// ─── Key factory ────────────────────────────────────────────────────────────

export const messageFlagKeys = {
  byChatAndUser: (chatId: string | null, userId: string | null) =>
    ['message-flags', chatId, userId] as const,
};

// ─── useMessageFlags ─────────────────────────────────────────────────────────

/**
 * Expõe os favoritos do usuário atual em um chat específico.
 *
 * @param chatId - UUID do chat. Sem dados quando null.
 * @returns
 *   - `flagsQuery` — lista de flags do usuário no chat.
 *   - `isFlagged(messageId)` — helper derivado: retorna true se a mensagem está flagada.
 *   - `flagMutation` — INSERT de flag.
 *   - `unflagMutation` — DELETE de flag por message_id.
 *   - `flaggedCount` — total de mensagens favoritadas neste chat pelo usuário.
 */
export function useMessageFlags(chatId: string | null | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const flagsQuery = useQuery({
    queryKey: messageFlagKeys.byChatAndUser(chatId ?? null, userId),
    enabled: !!chatId && !!userId,
    queryFn: async (): Promise<MessageFlag[]> => {
      const { data, error } = await supabase
        .from('zapi_chat_message_flags')
        .select('id, message_id, chat_id, flagged_by, created_at')
        .eq('chat_id', chatId!)
        .eq('flagged_by', userId!);

      if (error) throw error;
      return (data ?? []) as MessageFlag[];
    },
  });

  /** Set de message_ids flagados — derivado da query, sem re-fetch. */
  const flaggedSet = useMemo(() => {
    const s = new Set<string>();
    (flagsQuery.data ?? []).forEach((f) => s.add(f.message_id));
    return s;
  }, [flagsQuery.data]);

  /** Retorna true se a mensagem está favoritada pelo usuário atual. */
  function isFlagged(messageId: string): boolean {
    return flaggedSet.has(messageId);
  }

  /** INSERT de flag com optimistic update. */
  const flagMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!chatId || !userId) throw new Error('Chat ou usuário não identificado');
      const { error } = await supabase
        .from('zapi_chat_message_flags')
        .insert({ chat_id: chatId, message_id: messageId, flagged_by: userId });
      if (error) throw error;
    },
    onMutate: async (messageId) => {
      if (!chatId || !userId) return;
      const key = messageFlagKeys.byChatAndUser(chatId, userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MessageFlag[]>(key) ?? [];
      const optimistic: MessageFlag = {
        id: `optimistic-${messageId}`,
        chat_id: chatId,
        message_id: messageId,
        flagged_by: userId,
        created_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by: null,
        deleted_batch_id: null,
      };
      queryClient.setQueryData<MessageFlag[]>(key, [...previous, optimistic]);
      return { previous };
    },
    onError: (_err, _messageId, ctx) => {
      if (!chatId || !userId) return;
      const key = messageFlagKeys.byChatAndUser(chatId, userId);
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error('Erro ao favoritar mensagem');
    },
    onSuccess: () => {
      if (!chatId || !userId) return;
      queryClient.invalidateQueries({
        queryKey: messageFlagKeys.byChatAndUser(chatId, userId),
      });
    },
  });

  /** DELETE de flag por message_id com optimistic update. */
  const unflagMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!chatId || !userId) throw new Error('Chat ou usuário não identificado');
      const { error } = await supabase
        .from('zapi_chat_message_flags')
        .delete()
        .eq('chat_id', chatId)
        .eq('message_id', messageId)
        .eq('flagged_by', userId);
      if (error) throw error;
    },
    onMutate: async (messageId) => {
      if (!chatId || !userId) return;
      const key = messageFlagKeys.byChatAndUser(chatId, userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MessageFlag[]>(key) ?? [];
      queryClient.setQueryData<MessageFlag[]>(
        key,
        previous.filter((f) => f.message_id !== messageId),
      );
      return { previous };
    },
    onError: (_err, _messageId, ctx) => {
      if (!chatId || !userId) return;
      const key = messageFlagKeys.byChatAndUser(chatId, userId);
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error('Erro ao remover favorito');
    },
    onSuccess: () => {
      if (!chatId || !userId) return;
      queryClient.invalidateQueries({
        queryKey: messageFlagKeys.byChatAndUser(chatId, userId),
      });
    },
  });

  /** Toggle: flag se não flagado, unflag se flagado. */
  function toggleFlag(messageId: string) {
    if (isFlagged(messageId)) {
      unflagMutation.mutate(messageId);
    } else {
      flagMutation.mutate(messageId);
    }
  }

  return {
    flagsQuery,
    flaggedSet,
    isFlagged,
    flagMutation,
    unflagMutation,
    toggleFlag,
    flaggedCount: flaggedSet.size,
  };
}
