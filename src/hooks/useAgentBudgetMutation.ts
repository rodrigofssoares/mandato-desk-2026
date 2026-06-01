import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';

// ============================================================================
// Schema Zod de validação
// ============================================================================

export const budgetSchema = z.object({
  monthly_limit_brl: z
    .number()
    .min(20, 'Mínimo R$ 20')
    .max(500, 'Máximo R$ 500'),
  // NULL = alerta desabilitado (migration 104 tornou colunas nullable)
  threshold_yellow_pct: z
    .number()
    .min(50)
    .max(95)
    .nullable(),
  threshold_red_pct: z
    .number()
    .min(60)
    .max(99)
    .nullable(),
  auto_block_at_100: z.boolean(),
  max_tokens_per_response: z
    .number()
    .min(512)
    .max(8192),
  max_messages_per_user_per_day: z
    .number()
    .min(1)
    .max(500),
  max_brl_per_user_per_month: z
    .number()
    .min(1)
    .max(100),
});

export type BudgetInput = z.infer<typeof budgetSchema>;

// ============================================================================
// Hook: useUpdateBudget
// ============================================================================

/**
 * Atualiza `ai_agent_budget` pelo id.
 * Valida com Zod antes de enviar.
 * NULL em threshold_yellow_pct / threshold_red_pct = alerta desabilitado.
 */
export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: BudgetInput;
    }) => {
      // Validação Zod — lança ZodError em caso de dados inválidos
      const validated = budgetSchema.parse(data);

      const { error } = await supabase
        .from('ai_agent_budget' as never)
        .update(validated as Record<string, unknown>)
        .eq('id', id as never);

      if (error) throw error;

      return { id };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent_budget'] });
      queryClient.invalidateQueries({ queryKey: ['agent_budget_spend'] });

      // Audit trail B1: mudança de orçamento é auditável (sem api_key)
      void logActivity({
        type: 'update',
        entity_type: 'ai_agent_budget',
        entity_name: 'Orçamento do agente',
        entity_id: variables.id,
        description: 'Configuração de orçamento atualizada',
      });

      toast.success('Orçamento salvo');
    },
    // MF-1: onError tipado como unknown para que instanceof funcione corretamente
    onError: (error: unknown) => {
      if (error instanceof z.ZodError) {
        toast.error(`Dados inválidos: ${error.errors[0].message}`);
      } else if (error instanceof Error) {
        toast.error(`Erro ao salvar orçamento: ${error.message}`);
      } else {
        toast.error('Erro ao salvar orçamento');
      }
    },
  });
}
