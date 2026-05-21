import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useAgentSettings } from '@/hooks/useAgentSettings';

// ============================================================================
// Tipos
// ============================================================================

export interface AgentBudget {
  id: string;
  agent_id: string;
  monthly_limit_brl: number;
  threshold_yellow_pct: number;
  threshold_red_pct: number;
  auto_block_at_100: boolean;
  max_tokens_per_response: number;
  max_messages_per_user_per_day: number;
  max_brl_per_user_per_month: number;
  created_at: string;
  updated_at: string;
}

export type BudgetStatus = 'ok' | 'yellow' | 'red' | 'blocked';

export interface AgentBudgetWithSpend extends AgentBudget {
  /** Gasto do mês corrente em BRL (retornado pela função SQL) */
  current_spend: number;
  /** Percentual usado: (current_spend / monthly_limit_brl) × 100 */
  percent_used: number;
  /** Status calculado com base nos thresholds */
  status: BudgetStatus;
}

// ============================================================================
// Hook: useAgentBudget
// ============================================================================

/**
 * Lê a configuração de orçamento do agente.
 * Apenas admin tem acesso (RLS).
 * Mutations vêm na Onda 3 (sub-aba Orçamento).
 */
export function useAgentBudget() {
  const { isAdmin } = useUserRole();

  return useQuery<AgentBudget | null>({
    queryKey: ['agent_budget'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_budget' as never)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const row = data as Record<string, unknown>;
      return {
        id: row.id as string,
        agent_id: row.agent_id as string,
        monthly_limit_brl: Number(row.monthly_limit_brl),
        threshold_yellow_pct: Number(row.threshold_yellow_pct),
        threshold_red_pct: Number(row.threshold_red_pct),
        auto_block_at_100: row.auto_block_at_100 as boolean,
        max_tokens_per_response: Number(row.max_tokens_per_response),
        max_messages_per_user_per_day: Number(row.max_messages_per_user_per_day),
        max_brl_per_user_per_month: Number(row.max_brl_per_user_per_month),
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      } satisfies AgentBudget;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Hook: useAgentBudgetSpend
// ============================================================================

/**
 * Chama a função SQL `ai_agent_current_spend(agent_id)` e combina com a
 * configuração de orçamento para retornar o status financeiro atual.
 *
 * Retorna:
 * - `current_spend`: gasto do mês corrente em BRL
 * - `percent_used`: percentual usado do orçamento
 * - `status`: 'ok' | 'yellow' | 'red' | 'blocked'
 */
export function useAgentBudgetSpend() {
  const { isAdmin } = useUserRole();
  const budgetQuery = useAgentBudget();
  const agentQuery = useAgentSettings();

  const agentId = agentQuery.data?.id;
  const budget = budgetQuery.data;

  return useQuery<AgentBudgetWithSpend | null>({
    queryKey: ['agent_budget_spend', agentId],
    enabled: isAdmin && !!agentId && !!budget,
    queryFn: async () => {
      if (!agentId || !budget) return null;

      // Chama a função SQL que soma total_cost_brl do mês corrente
      const { data, error } = await supabase
        .rpc('ai_agent_current_spend', { p_agent_id: agentId });

      if (error) throw error;

      const currentSpend = Number(data ?? 0);
      const percentUsed =
        budget.monthly_limit_brl > 0
          ? (currentSpend / budget.monthly_limit_brl) * 100
          : 0;

      const status: BudgetStatus =
        percentUsed >= 100
          ? 'blocked'
          : percentUsed >= budget.threshold_red_pct
          ? 'red'
          : percentUsed >= budget.threshold_yellow_pct
          ? 'yellow'
          : 'ok';

      return {
        ...budget,
        current_spend: currentSpend,
        percent_used: percentUsed,
        status,
      };
    },
    // Gasto muda a cada mensagem enviada — refresh frequente
    staleTime: 30 * 1000, // 30 segundos
    refetchInterval: 60 * 1000, // revalida a cada minuto
  });
}
