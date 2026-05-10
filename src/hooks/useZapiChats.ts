import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type ZapiChat = Tables<'zapi_chats'> & {
  contact_name?: string | null;
};

// ─── Key Factory ────────────────────────────────────────────────────────────

export const zapiChatKeys = {
  all: ['zapi-chats'] as const,
  byAccount: (accountId: string | null) => ['zapi-chats', accountId] as const,
};

// ─── useZapiChats ───────────────────────────────────────────────────────────

/**
 * Lista chats de uma conta Z-API ordenados por última mensagem (DESC).
 * Inclui o nome do contato CRM vinculado (LEFT JOIN com contacts).
 *
 * Realtime: subscribe em INSERT/UPDATE em zapi_chats filtrando por account_id.
 * Cleanup automático no unmount.
 *
 * Quando accountId é null/undefined retorna [] sem disparar query.
 */
export function useZapiChats(accountId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: zapiChatKeys.byAccount(accountId ?? null),
    enabled: !!accountId,
    queryFn: async (): Promise<ZapiChat[]> => {
      const { data, error } = await supabase
        .from('zapi_chats')
        .select('*, contacts:contact_id (name)')
        .eq('account_id', accountId!)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const { contacts, ...rest } = row as typeof row & {
          contacts: { name: string } | null;
        };
        return {
          ...rest,
          contact_name: contacts?.name ?? null,
        } as ZapiChat;
      });
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel(`zapi-chats-${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zapi_chats',
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: zapiChatKeys.byAccount(accountId) });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, queryClient]);

  return query;
}

// ─── useMarkChatAsRead ─────────────────────────────────────────────────────

/**
 * Zera unread_count de um chat. Disparado automaticamente quando o usuário
 * abre o chat na UI. RLS bloqueia escrita direta — vai falhar silenciosamente
 * pra não-service_role. Por enquanto fica no-op até implementarmos via EF
 * (futuro: zapi-mark-as-read). Mantido como mutation pra UI consumir desde já.
 */
export function useMarkChatAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_chatId: string) => {
      // No-op MVP: RLS bloqueia escrita do client. Quando EF for criada,
      // troca esta linha por supabase.functions.invoke('zapi-mark-as-read', ...).
      return { ok: true } as const;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zapiChatKeys.all });
    },
  });
}
