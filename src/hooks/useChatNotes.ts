import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ChatNote = Tables<'zapi_chat_notes'> & {
  autor: { nome: string } | null;
};

// ─── Key Factory ─────────────────────────────────────────────────────────────

export const chatNoteKeys = {
  byChatId: (chatId: string | null) => ['chat-notes', chatId] as const,
};

// ─── useChatNotes ─────────────────────────────────────────────────────────────

/**
 * Hook de CRUD para `zapi_chat_notes` de uma conversa.
 *
 * - `notesQuery`: lista notas ordenadas por created_at ASC, com JOIN em profiles(nome).
 * - `createNoteMutation`: INSERT direto pelo client (RLS garante autor_id = auth.uid()).
 * - `deleteNoteMutation`: DELETE pelo id da nota (RLS garante só próprio autor ou admin).
 *
 * Quando chatId é null, a query fica desabilitada (enabled: false).
 */
export function useChatNotes(chatId: string | null | undefined) {
  const queryClient = useQueryClient();
  const resolvedId = chatId ?? null;

  // ── Query ─────────────────────────────────────────────────────────────────
  const notesQuery = useQuery<ChatNote[]>({
    queryKey: chatNoteKeys.byChatId(resolvedId),
    enabled: !!resolvedId,
    queryFn: async (): Promise<ChatNote[]> => {
      const { data, error } = await supabase
        .from('zapi_chat_notes')
        .select('*, autor:profiles!autor_id(nome)')
        .eq('chat_id', resolvedId!)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data ?? []) as ChatNote[];
    },
  });

  // ── Create ────────────────────────────────────────────────────────────────
  const createNoteMutation = useMutation({
    mutationFn: async ({
      chat_id,
      corpo,
      mencoes,
      autor_id,
    }: {
      chat_id: string;
      corpo: string;
      mencoes?: string[] | null;
      /** autor_id é definido pelo RLS; este campo é necessário apenas porque o tipo Insert o exige.
       *  O banco sobrescreve com auth.uid() via política RLS. */
      autor_id: string;
    }) => {
      // Limite de segurança: no máximo 20 menções por nota.
      if (mencoes && mencoes.length > 20) {
        throw new Error('Máximo de 20 menções por nota');
      }

      const { data, error } = await supabase
        .from('zapi_chat_notes')
        .insert({
          chat_id,
          corpo,
          mencoes: mencoes && mencoes.length > 0 ? (mencoes as unknown as Tables<'zapi_chat_notes'>['mencoes']) : null,
          autor_id,
        })
        .select('*, autor:profiles!autor_id(nome)')
        .single();

      if (error) throw error;
      return data as ChatNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatNoteKeys.byChatId(resolvedId) });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar nota: ${err.message}`);
    },
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('zapi_chat_notes')
        .delete()
        .eq('id', noteId)
        .eq('chat_id', resolvedId!); // defesa em profundidade — amarra o escopo da conversa (RLS já cobre)

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatNoteKeys.byChatId(resolvedId) });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir nota: ${err.message}`);
    },
  });

  return { notesQuery, createNoteMutation, deleteNoteMutation };
}
