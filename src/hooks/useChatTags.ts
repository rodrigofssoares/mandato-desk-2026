// Hook: useChatTags
//
// Lista, adiciona e remove etiquetas de uma conversa WhatsApp.
// A escrita vai via Edge Function zapi-chat-tag-update (service_role).
//
// - tagsQuery: SELECT zapi_chat_tags + join em tags (nome, cor)
// - addTagMutation: chama zapi-chat-tag-update com action='add'
// - removeTagMutation: chama zapi-chat-tag-update com action='remove'
//
// Referência: RAQ-MAND-EM073 — T45

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ChatTag {
  id: string;          // ID do registro zapi_chat_tags
  chat_id: string;
  tag_id: string;
  tag_nome: string;
  tag_cor: string;
  created_at: string;
}

// ─── Key factory ─────────────────────────────────────────────────────────────

export const chatTagKeys = {
  byChat: (chatId: string | null) => ['chat-tags', chatId] as const,
};

// ─── useChatTags ─────────────────────────────────────────────────────────────

/**
 * Gerencia etiquetas de uma conversa WhatsApp.
 * @param chatId - ID do chat (null = hook desabilitado).
 */
export function useChatTags(chatId: string | null) {
  const queryClient = useQueryClient();

  // ── Listagem ────────────────────────────────────────────────────────────────
  const tagsQuery = useQuery<ChatTag[]>({
    queryKey: chatTagKeys.byChat(chatId),
    enabled: !!chatId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zapi_chat_tags')
        .select('id, chat_id, tag_id, created_at, tags:tag_id(nome, cor)')
        .eq('chat_id', chatId!)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => {
        // Supabase retorna a FK join como array; pegamos o primeiro elemento
        const rawTags = (row as unknown as { tags: { nome: string; cor: string }[] | null }).tags;
        const tagData = Array.isArray(rawTags) ? rawTags[0] : (rawTags as { nome: string; cor: string } | null);
        return {
          id: row.id,
          chat_id: row.chat_id,
          tag_id: row.tag_id,
          tag_nome: tagData?.nome ?? 'Sem nome',
          tag_cor: tagData?.cor ?? '#6B7280',
          created_at: row.created_at,
        } as ChatTag;
      });
    },
  });

  // ── Adicionar etiqueta ───────────────────────────────────────────────────────
  const addTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { data, error } = await supabase.functions.invoke('zapi-chat-tag-update', {
        body: { chat_id: chatId, tag_id: tagId, action: 'add' },
      });

      if (error) {
        let detail = error.message ?? 'Erro ao adicionar etiqueta';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.text === 'function') {
          try {
            const raw = await ctx.text();
            const parsed = JSON.parse(raw);
            if (parsed?.error) detail = parsed.error;
          } catch { /* sem JSON */ }
        }
        throw new Error(detail);
      }

      return data;
    },
    onSuccess: () => {
      if (chatId) queryClient.invalidateQueries({ queryKey: chatTagKeys.byChat(chatId) });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao adicionar etiqueta: ${err.message}`);
    },
  });

  // ── Remover etiqueta ─────────────────────────────────────────────────────────
  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { data, error } = await supabase.functions.invoke('zapi-chat-tag-update', {
        body: { chat_id: chatId, tag_id: tagId, action: 'remove' },
      });

      if (error) {
        let detail = error.message ?? 'Erro ao remover etiqueta';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.text === 'function') {
          try {
            const raw = await ctx.text();
            const parsed = JSON.parse(raw);
            if (parsed?.error) detail = parsed.error;
          } catch { /* sem JSON */ }
        }
        throw new Error(detail);
      }

      return data;
    },
    onSuccess: () => {
      if (chatId) queryClient.invalidateQueries({ queryKey: chatTagKeys.byChat(chatId) });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover etiqueta: ${err.message}`);
    },
  });

  return { tagsQuery, addTagMutation, removeTagMutation };
}
