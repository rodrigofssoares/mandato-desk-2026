// Hook: useAuditLog
//
// Consulta paginada de zapi_audit_log via RPC get_audit_log (SECURITY DEFINER).
// A RPC verifica que o caller tem role=admin antes de retornar dados.
// Enriquece com nome do ator via query separada em profiles.
//
// Segurança: SELECT direto em zapi_audit_log foi revogado para authenticated
// (migration 083). Acesso apenas via esta RPC (admin only).
//
// Referência: RAQ-MAND-EM073 — T89 (Fase 7 Onda B) + Hardening de Segurança

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  account_id: string | null;
  chat_id: string | null;
  contact_id: string | null;
  event_type: string;
  actor_id: string | null;
  actor_nome?: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  /** Telefone do chat para exibição */
  chat_phone?: string | null;
}

export interface UseAuditLogParams {
  accountId?: string | null;
  chatId?: string | null;
  eventTypes?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  /** Quantos registros por página (padrão 20, máx 100) */
  limit?: number;
  /** Offset para paginação */
  offset?: number;
}

// ─── queryKey factory ────────────────────────────────────────────────────────

export const auditLogKeys = {
  all: ['audit-log'] as const,
  list: (params: UseAuditLogParams) => ['audit-log', params] as const,
};

// ─── useAuditLog ──────────────────────────────────────────────────────────────

/**
 * Consulta paginada de zapi_audit_log via RPC get_audit_log (admin only).
 * Ordenado por created_at DESC.
 * Enriquece com nome do ator via join com profiles.
 */
export function useAuditLog(params: UseAuditLogParams = {}) {
  const {
    accountId,
    chatId,
    eventTypes,
    dateFrom,
    dateTo,
    limit = 20,
    offset = 0,
  } = params;

  return useQuery<{ data: AuditLogEntry[]; count: number }>({
    queryKey: auditLogKeys.list(params),
    queryFn: async () => {
      // Chama RPC SECURITY DEFINER (admin only — migração 083)
      const { data: rpcData, error } = await supabase.rpc('get_audit_log', {
        p_account_id:  accountId && accountId !== '__all__' ? accountId : null,
        p_chat_id:     chatId ?? null,
        p_event_types: eventTypes && eventTypes.length > 0 ? eventTypes : null,
        p_date_from:   dateFrom ?? null,
        p_date_to:     dateTo ?? null,
        p_limit:       Math.min(limit, 100),
        p_offset:      offset,
      });

      if (error) throw error;

      const rows = (rpcData ?? []) as Array<{
        id: string;
        account_id: string | null;
        chat_id: string | null;
        contact_id: string | null;
        event_type: string;
        actor_id: string | null;
        old_value: Record<string, unknown> | null;
        new_value: Record<string, unknown> | null;
        created_at: string;
        /** Total de registros que satisfazem os filtros (COUNT(*) OVER()) */
        total_count: number | null;
      }>;

      // Enriquece com nome do ator via profiles (batch por actor_id únicos)
      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
      const actorMap = new Map<string, string | null>();

      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', actorIds);
        for (const p of profiles ?? []) {
          actorMap.set(p.id, (p as { id: string; nome?: string | null }).nome ?? null);
        }
      }

      // Enriquece com telefone do chat (batch por chat_id únicos)
      const chatIds = [...new Set(rows.map((r) => r.chat_id).filter(Boolean))] as string[];
      const chatMap = new Map<string, string | null>();

      if (chatIds.length > 0) {
        const { data: chats } = await supabase
          .from('zapi_chats')
          .select('id, phone')
          .in('id', chatIds);
        for (const c of chats ?? []) {
          chatMap.set(c.id, (c as { id: string; phone?: string | null }).phone ?? null);
        }
      }

      const entries: AuditLogEntry[] = rows.map((row) => ({
        id:         row.id,
        account_id: row.account_id,
        chat_id:    row.chat_id,
        contact_id: row.contact_id,
        event_type: row.event_type,
        actor_id:   row.actor_id,
        actor_nome: row.actor_id ? (actorMap.get(row.actor_id) ?? null) : null,
        old_value:  (row.old_value as Record<string, unknown>) ?? null,
        new_value:  (row.new_value as Record<string, unknown>) ?? null,
        created_at: row.created_at,
        chat_phone: row.chat_id ? (chatMap.get(row.chat_id) ?? null) : null,
      }));

      // total_count vem do COUNT(*) OVER() da RPC — reflete o total de registros com os filtros
      // aplicados, independentemente do LIMIT/OFFSET. Usa o valor da primeira linha (todas são iguais).
      const totalCount = rows.length > 0 ? (rows[0].total_count ?? entries.length) : 0;

      return { data: entries, count: totalCount };
    },
  });
}
