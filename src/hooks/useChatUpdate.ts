import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { zapiChatKeys, type ZapiChat } from '@/hooks/useZapiChats';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ChatPatch {
  status?: 'aberta' | 'em_atendimento' | 'aguardando' | 'finalizada';
  assigned_to?: string | null;
  pinned?: boolean;
  archived?: boolean;
  snoozed_until?: string | null;
  /** T26: true = seta unread_count=1; false = zera unread_count=0 */
  unread?: boolean;
}

interface UseChatUpdateParams {
  chat_id: string;
  patch: ChatPatch;
}

// ─── useChatUpdate ────────────────────────────────────────────────────────────

/**
 * Mutation para atualização parcial de estado de um chat Z-API.
 * Chama a Edge Function `zapi-chat-update` com optimistic update no cache.
 *
 * @param accountId — necessário para identificar e invalidar a query correta.
 */
export function useChatUpdate(accountId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chat_id, patch }: UseChatUpdateParams) => {
      const { data, error } = await supabase.functions.invoke('zapi-chat-update', {
        body: { chat_id, patch },
      });

      if (error) {
        let detail = error.message ?? 'Erro ao atualizar conversa';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.text === 'function') {
          try {
            const raw = await ctx.text();
            try {
              const body = JSON.parse(raw);
              if (body?.error) detail = body.error;
            } catch {
              /* sem body JSON */
            }
          } catch {
            /* sem body disponível */
          }
        }
        throw new Error(detail);
      }

      return (data as { ok: boolean; chat: ZapiChat }).chat;
    },

    // ── Optimistic update ─────────────────────────────────────────────────────
    onMutate: async ({ chat_id, patch }) => {
      if (!accountId) return;

      // Cancela queries em voo para evitar sobrescrever o optimistic update
      await queryClient.cancelQueries({ queryKey: zapiChatKeys.byAccount(accountId) });

      // Snapshot para rollback em caso de erro
      const previous = queryClient.getQueryData<ZapiChat[]>(zapiChatKeys.byAccount(accountId));

      // Aplica patch localmente no cache
      queryClient.setQueryData<ZapiChat[]>(zapiChatKeys.byAccount(accountId), (old) => {
        if (!old) return old;
        return old.map((chat) => {
          if (chat.id !== chat_id) return chat;
          const updated = { ...chat };
          if ('status' in patch && patch.status !== undefined) updated.status = patch.status;
          if ('assigned_to' in patch) updated.assigned_to = patch.assigned_to ?? null;
          if ('pinned' in patch && patch.pinned !== undefined) updated.pinned = patch.pinned;
          if ('archived' in patch && patch.archived !== undefined) updated.archived = patch.archived;
          if ('snoozed_until' in patch) updated.snoozed_until = patch.snoozed_until ?? null;
          if ('unread' in patch && patch.unread !== undefined) {
            updated.unread_count = patch.unread ? 1 : 0;
          }
          return updated;
        });
      });

      return { previous };
    },

    onError: (err, _vars, context) => {
      // Rollback
      if (accountId && context?.previous !== undefined) {
        queryClient.setQueryData<ZapiChat[]>(zapiChatKeys.byAccount(accountId), context.previous);
      }
      toast.error(`Erro ao atualizar conversa: ${err.message}`);
    },

    onSuccess: () => {
      if (!accountId) return;
      queryClient.invalidateQueries({ queryKey: zapiChatKeys.byAccount(accountId) });
    },
  });
}
