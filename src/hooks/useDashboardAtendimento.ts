// Hook: useDashboardAtendimento
//
// Consulta a VIEW v_dashboard_atendimento via RPC get_dashboard_atendimento
// (SECURITY DEFINER, admin only). Atualiza automaticamente a cada 60s.
//
// Segurança: SELECT direto na view foi revogado para authenticated (migration 083).
// Acesso apenas via RPC que verifica role=admin antes de retornar dados.
//
// Quando accountId = '__all__', busca todas as contas e agrega os valores no client.
//
// Referência: RAQ-MAND-EM073 — T89 (Fase 7 Onda B) + Hardening de Segurança

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AtendenteStat {
  assigned_to: string | null;
  nome: string | null;
  count: number;
}

export interface DashboardAtendimento {
  account_id: string;
  conversas_abertas: number;
  conversas_finalizadas_hoje: number;
  conversas_por_atendente: AtendenteStat[];
  tempo_medio_resposta_min: number | null;
}

// ─── queryKey factory ────────────────────────────────────────────────────────

export const dashboardAtendimentoKeys = {
  all: ['dashboard-atendimento'] as const,
  byAccount: (accountId: string | null) =>
    ['dashboard-atendimento', accountId] as const,
};

// ─── useDashboardAtendimento ──────────────────────────────────────────────────

/**
 * Busca métricas de atendimento via RPC get_dashboard_atendimento (admin only).
 *
 * @param accountId - UUID da conta, ou '__all__' para agregar todas.
 */
export function useDashboardAtendimento(accountId: string | null | undefined) {
  return useQuery<DashboardAtendimento | null>({
    queryKey: dashboardAtendimentoKeys.byAccount(accountId ?? null),
    enabled: !!accountId,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!accountId) return null;

      // Chama RPC SECURITY DEFINER (admin only — migração 083)
      const { data: rpcData, error } = await supabase.rpc('get_dashboard_atendimento', {
        p_account_id: accountId === '__all__' ? null : accountId,
      });

      if (error) throw error;

      const rows = (rpcData ?? []) as DashboardAtendimentoRow[];

      if (accountId === '__all__') {
        if (!rows || rows.length === 0) return null;

        const totalAbertas     = rows.reduce((s, r) => s + (r.conversas_abertas ?? 0), 0);
        const totalFinalizadas = rows.reduce((s, r) => s + (r.conversas_finalizadas_hoje ?? 0), 0);

        const atendenteMap = new Map<string, AtendenteStat>();
        for (const row of rows) {
          const lista = parseAtendentes(row.conversas_por_atendente);
          for (const a of lista) {
            const key  = a.assigned_to ?? '__unassigned__';
            const prev = atendenteMap.get(key);
            if (prev) {
              atendenteMap.set(key, { ...prev, count: prev.count + a.count });
            } else {
              atendenteMap.set(key, { ...a });
            }
          }
        }

        let sumTempo   = 0;
        let totalPeso  = 0;
        for (const row of rows) {
          if (row.tempo_medio_resposta_min != null && row.conversas_abertas != null) {
            sumTempo  += row.tempo_medio_resposta_min * row.conversas_abertas;
            totalPeso += row.conversas_abertas;
          }
        }
        const tempoMedio = totalPeso > 0 ? sumTempo / totalPeso : null;

        return {
          account_id:                '__all__',
          conversas_abertas:         totalAbertas,
          conversas_finalizadas_hoje: totalFinalizadas,
          conversas_por_atendente:   Array.from(atendenteMap.values()).sort(
            (a, b) => b.count - a.count,
          ),
          tempo_medio_resposta_min:  tempoMedio,
        };
      }

      // Conta específica
      if (!rows || rows.length === 0) {
        return {
          account_id:                accountId,
          conversas_abertas:         0,
          conversas_finalizadas_hoje: 0,
          conversas_por_atendente:   [],
          tempo_medio_resposta_min:  null,
        };
      }

      const row = rows[0];
      return {
        account_id:                row.account_id ?? accountId,
        conversas_abertas:         row.conversas_abertas ?? 0,
        conversas_finalizadas_hoje: row.conversas_finalizadas_hoje ?? 0,
        conversas_por_atendente:   parseAtendentes(row.conversas_por_atendente),
        tempo_medio_resposta_min:  row.tempo_medio_resposta_min ?? null,
      };
    },
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

interface DashboardAtendimentoRow {
  account_id?: string | null;
  conversas_abertas?: number | null;
  conversas_finalizadas_hoje?: number | null;
  conversas_por_atendente?: unknown;
  tempo_medio_resposta_min?: number | null;
}

function parseAtendentes(raw: unknown): AtendenteStat[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      assigned_to: typeof item.assigned_to === 'string' ? item.assigned_to : null,
      nome:        typeof item.nome === 'string' ? item.nome : null,
      count:       typeof item.count === 'number' ? item.count : 0,
    }));
}
