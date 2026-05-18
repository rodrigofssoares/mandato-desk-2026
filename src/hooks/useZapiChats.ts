import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type ZapiChat = Tables<'zapi_chats'> & {
  contact_name?: string | null;
  /** T16: profissão/empresa do contato vinculado */
  contact_profissao?: string | null;
  /** T16: tags do contato vinculado */
  contact_tags?: { tags: { nome: string } }[] | null;
  /** T68 (Fase 6 Onda A): data de nascimento do contato (para badge aniversariante) */
  contact_data_nascimento?: string | null;
  /** T67 (Fase 6 Onda A): bairro do contato (para subtítulo no ChatListItem) */
  contact_bairro?: string | null;
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
        .select('*, contacts:contact_id (nome, profissao, data_nascimento, bairro, contact_tags(tags(nome)))')
        .eq('account_id', accountId!)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const { contacts, ...rest } = row as typeof row & {
          contacts: {
            nome: string;
            profissao?: string | null;
            data_nascimento?: string | null;
            bairro?: string | null;
            contact_tags?: { tags: { nome: string } }[] | null;
          } | null;
        };
        return {
          ...rest,
          contact_name: contacts?.nome ?? null,
          contact_profissao: contacts?.profissao ?? null,
          contact_data_nascimento: contacts?.data_nascimento ?? null,
          contact_bairro: contacts?.bairro ?? null,
          contact_tags: contacts?.contact_tags ?? null,
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

// ─── useAllZapiChats ──────────────────────────────────────────────────────────

/** Chat enriquecido com nome da conta para a visão consolidada multi-instância (C26). */
export type ZapiChatWithAccount = ZapiChat & {
  account_name?: string | null;
};

/**
 * T87 — Visão consolidada multi-instância (C26).
 *
 * Busca todos os chats de todas as contas ativas do usuário (sem filtro de account_id).
 * Enriquece cada chat com `account_name` via JOIN com zapi_accounts.
 *
 * Realtime: subscrito a zapi_chats sem filtro de account_id — todos os eventos chegam.
 */
export function useAllZapiChats() {
  const queryClient = useQueryClient();
  const ALL_KEY = ['zapi-chats', '__all__'] as const;

  const query = useQuery({
    queryKey: ALL_KEY,
    queryFn: async (): Promise<ZapiChatWithAccount[]> => {
      const { data, error } = await supabase
        .from('zapi_chats')
        .select('*, zapi_accounts:account_id(name), contacts:contact_id(nome, profissao, data_nascimento, bairro, contact_tags(tags(nome)))')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const { zapi_accounts, contacts, ...rest } = row as typeof row & {
          zapi_accounts?: { name?: string | null } | null;
          contacts?: {
            nome: string;
            profissao?: string | null;
            data_nascimento?: string | null;
            bairro?: string | null;
            contact_tags?: { tags: { nome: string } }[] | null;
          } | null;
        };
        return {
          ...rest,
          account_name: zapi_accounts?.name ?? null,
          contact_name: contacts?.nome ?? null,
          contact_profissao: contacts?.profissao ?? null,
          contact_data_nascimento: contacts?.data_nascimento ?? null,
          contact_bairro: contacts?.bairro ?? null,
          contact_tags: contacts?.contact_tags ?? null,
        } as ZapiChatWithAccount;
      });
    },
  });

  // Realtime sem filtro de account_id — todos os eventos de todas as contas
  useEffect(() => {
    const channel = supabase
      .channel('zapi-chats-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'zapi_chats' },
        () => {
          queryClient.invalidateQueries({ queryKey: ALL_KEY });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  return query;
}

// ─── useMarkChatAsRead ─────────────────────────────────────────────────────

/**
 * Zera unread_count de um chat via Edge Function zapi-mark-as-read.
 * Disparado automaticamente quando o usuário abre o chat na UI.
 * RLS bloqueia escrita direta do client — a EF usa service_role.
 */
export function useMarkChatAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatId: string) => {
      const { data, error } = await supabase.functions.invoke('zapi-mark-as-read', {
        body: { chat_id: chatId },
      });

      if (error) {
        // Não lança erro para o usuário — marcar como lida é operação silenciosa
        console.warn('useMarkChatAsRead: falha ao marcar como lida', error.message);
        return { ok: false } as const;
      }

      return (data as { ok: boolean; updated?: boolean }) ?? { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zapiChatKeys.all });
    },
  });
}
