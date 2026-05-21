import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

// ============================================================================
// Schema Zod de validação
// ============================================================================

export const budgetSchema = z.object({
  monthly_limit_brl: z
    .number()
    .min(20, 'Mínimo R$ 20')
    .max(500, 'Máximo R$ 500'),
  threshold_yellow_pct: z
    .number()
    .min(50)
    .max(95),
  threshold_red_pct: z
    .number()
    .min(60)
    .max(99),
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
      // Validação Zod
      const validated = budgetSchema.parse(data);

      const { error } = await supabase
        .from('ai_agent_budget' as never)
        .update(validated as Record<string, unknown>)
        .eq('id', id as never);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_budget'] });
      queryClient.invalidateQueries({ queryKey: ['agent_budget_spend'] });
      toast.success('Orçamento salvo');
    },
    onError: (error: Error) => {
      if (error instanceof z.ZodError) {
        toast.error(`Dados inválidos: ${error.errors[0].message}`);
      } else {
        toast.error(`Erro ao salvar orçamento: ${error.message}`);
      }
    },
  });
}
