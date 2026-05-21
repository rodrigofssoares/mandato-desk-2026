import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

// ============================================================================
// Tipos
// ============================================================================

export interface AgentSettingsInput {
  name?: string;
  system_prompt?: string | null;
  is_active?: boolean;
  text_only_mode?: boolean;
}

// ============================================================================
// Hook: useUpsertAgentSettings
// ============================================================================

/**
 * Mutation para atualizar a linha singleton de `ai_agents`.
 * Aceita id do agente + campos a alterar.
 * Invalida cache ['agent_settings'] após sucesso.
 */
export function useUpsertAgentSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: AgentSettingsInput;
    }) => {
      const { error } = await supabase
        .from('ai_agents' as never)
        .update(data as Record<string, unknown>)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent_settings'] });

      // Log de atividade — sem incluir o prompt completo
      void logActivity({
        type: 'update',
        entity_type: 'ai_settings',
        entity_name: 'Agente IA',
        entity_id: variables.id,
        description: 'Configuração do agente atualizada',
      });

      toast.success('Configuração salva');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });
}
