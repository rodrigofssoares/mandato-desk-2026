// Hook: useScheduledMessages
//
// Lista e cancela mensagens agendadas para um chat específico.
// Usado pelo componente de agendamento no ChatPanel (T43).
//
// - listQuery: SELECT zapi_scheduled_messages WHERE chat_id + status='pendente'
// - createMutation: chama EF zapi-schedule-message (INSERT direto bloqueado via RLS)
// - cancelMutation: DELETE da mensagem (permitido por RLS quando status='pendente')
//
// Segurança: INSERT direto bloqueado via policy WITH CHECK (false) — mig 066.
// A createMutation usa supabase.functions.invoke para passar pelo fluxo seguro
// da EF (validação de permissão, rate-limit, janela temporal, account_id).
//
// Referência: RAQ-MAND-EM073 — Security Fix CRÍTICA-1

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ScheduledMessage {
  id: string;
  account_id: string;
  chat_id: string | null;
  phone: string;
  body: string;
  quoted_message_id: string | null;
  scheduled_at: string;
  status: 'pendente' | 'processando' | 'enviado' | 'falha' | 'cancelado';
  sent_at: string | null;
  error_msg: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ScheduledMessageInsert {
  account_id: string;
  chat_id: string | null;
  phone: string;
  body: string;
  quoted_message_id?: string | null;
  scheduled_at: string;
}

// ─── Key factory ─────────────────────────────────────────────────────────────

export const scheduledMsgKeys = {
  byChat: (chatId: string | null) => ['scheduled-messages', chatId] as const,
};

// ─── useScheduledMessages ────────────────────────────────────────────────────

/**
 * Gerencia mensagens agendadas de um chat específico.
 * @param chatId - ID do chat (null = hook desabilitado).
 */
export function useScheduledMessages(chatId: string | null) {
  const queryClient = useQueryClient();

  // ── Listagem ────────────────────────────────────────────────────────────────
  const listQuery = useQuery<ScheduledMessage[]>({
    queryKey: scheduledMsgKeys.byChat(chatId),
    enabled: !!chatId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zapi_scheduled_messages')
        .select('*')
        .eq('chat_id', chatId!)
        .eq('status', 'pendente')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ScheduledMessage[];
    },
    // Revalida a cada 30s para refletir mudanças de status
    refetchInterval: 30_000,
  });

  // ── Criação via Edge Function (INSERT direto bloqueado via RLS mig 066) ─────
  // A EF valida: permissão WhatsApp, account_id, phone, scheduled_at, rate-limit.
  // created_by é sempre = callerId no servidor — não aceito do body.
  const createMutation = useMutation({
    mutationFn: async (input: ScheduledMessageInsert) => {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean;
        id: string;
        scheduled_at: string;
      }>('zapi-schedule-message', {
        body: {
          account_id: input.account_id,
          chat_id: input.chat_id,
          phone: input.phone,
          body: input.body,
          quoted_message_id: input.quoted_message_id ?? null,
          scheduled_at: input.scheduled_at,
        },
      });

      if (error) {
        // Extrai mensagem de erro do corpo JSON da EF (se disponível)
        const errMsg = (error as { message?: string }).message ?? 'Erro ao agendar mensagem';
        throw new Error(errMsg);
      }

      if (!data?.ok) {
        throw new Error('Resposta inesperada do servidor');
      }

      return data;
    },
    onSuccess: (data) => {
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: scheduledMsgKeys.byChat(chatId) });
      }
      const dt = new Date(data.scheduled_at);
      const formatted = dt.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      toast.success(`Mensagem agendada para ${formatted}`);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao agendar mensagem: ${err.message}`);
    },
  });

  // ── Cancelamento ─────────────────────────────────────────────────────────────
  // DELETE via PostgREST — permitido por RLS (status='pendente' + created_by=uid).
  const cancelMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('zapi_scheduled_messages')
        .delete()
        .eq('id', messageId)
        .eq('status', 'pendente');

      if (error) throw error;
    },
    onSuccess: () => {
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: scheduledMsgKeys.byChat(chatId) });
      }
      toast.success('Agendamento cancelado');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao cancelar agendamento: ${err.message}`);
    },
  });

  return { listQuery, createMutation, cancelMutation };
}
