// Hook: useBulkChatUpdate
//
// Mutation para atualização em lote de múltiplos chats Z-API.
// Chama a Edge Function zapi-bulk-chat-update com { chat_ids, patch }.
// Aplica optimistic update no cache local antes do servidor confirmar.
//
// Referência: RAQ-MAND-EM073 — T44

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { zapiChatKeys, type ZapiChat } from '@/hooks/useZapiChats';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface BulkChatPatch {
  status?: 'aberta' | 'em_atendimento' | 'aguardando' | 'finalizada';
  assigned_to?: string | null;
  pinned?: boolean;
  archived?: boolean;
}

interface BulkUpdateParams {
  chat_ids: string[];
  patch: BulkChatPatch;
}

// ─── useBulkChatUpdate ────────────────────────────────────────────────────────

/**
 * Mutation para atualização em lote de conversas WhatsApp.
 * @param accountId - necessário para invalidar o cache correto.
 */
export function useBulkChatUpdate(accountId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chat_ids, patch }: BulkUpdateParams): Promise<{ ok: boolean; updated: number }> => {
      const { data, error } = await supabase.functions.invoke('zapi-bulk-chat-update', {
        body: { chat_ids, patch },
      });

      if (error) {
        let detail = error.message ?? 'Erro ao atualizar conversas';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.text === 'function') {
          try {
            const raw = await ctx.text();
            try {
              const parsed = JSON.parse(raw);
              if (parsed?.error) detail = parsed.error;
            } catch { /* sem JSON */ }
          } catch { /* sem body */ }
        }
        throw new Error(detail);
      }

      return data as { ok: boolean; updated: number };
    },

    // ── Optimistic update ─────────────────────────────────────────────────────
    onMutate: async ({ chat_ids, patch }) => {
      if (!accountId) return;

      await queryClient.cancelQueries({ queryKey: zapiChatKeys.byAccount(accountId) });
      const previous = queryClient.getQueryData<ZapiChat[]>(zapiChatKeys.byAccount(accountId));

      const idSet = new Set(chat_ids);
      queryClient.setQueryData<ZapiChat[]>(zapiChatKeys.byAccount(accountId), (old) => {
        if (!old) return old;
        return old.map((chat) => {
          if (!idSet.has(chat.id)) return chat;
          const updated = { ...chat };
          if ('status' in patch && patch.status !== undefined) updated.status = patch.status;
          if ('assigned_to' in patch) updated.assigned_to = patch.assigned_to ?? null;
          if ('pinned' in patch && patch.pinned !== undefined) updated.pinned = patch.pinned;
          if ('archived' in patch && patch.archived !== undefined) updated.archived = patch.archived;
          return updated;
        });
      });

      return { previous };
    },

    onError: (err, _vars, context) => {
      if (accountId && context?.previous !== undefined) {
        queryClient.setQueryData<ZapiChat[]>(zapiChatKeys.byAccount(accountId), context.previous);
      }
      toast.error(`Erro ao atualizar conversas: ${err.message}`);
    },

    onSuccess: () => {
      if (!accountId) return;
      queryClient.invalidateQueries({ queryKey: zapiChatKeys.byAccount(accountId) });
    },
  });
}
