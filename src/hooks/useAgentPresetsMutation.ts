import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';
import type { PresetKey } from '@/hooks/useAgentPresets';

// ============================================================================
// Hook: useSetActivePreset
// ============================================================================

/**
 * Ativa o preset escolhido via RPC atômica `set_active_preset`.
 * Substitui os 2 UPDATEs sequenciais que geravam race condition (migration 105).
 */
export function useSetActivePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agent_id,
      preset_key,
    }: {
      agent_id: string;
      preset_key: PresetKey;
    }) => {
      const { error } = await supabase.rpc(
        'set_active_preset' as never,
        { p_agent_id: agent_id, p_preset_key: preset_key } as never
      );

      if (error) throw error;

      return { agent_id, preset_key };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent_presets'] });

      // Audit trail B1
      void logActivity({
        type: 'update',
        entity_type: 'ai_agent_preset',
        entity_name: `Preset ${variables.preset_key}`,
        entity_id: variables.agent_id,
        description: `Preset ativado: ${variables.preset_key}`,
      });

      toast.success('Preset ativado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao ativar preset: ${error.message}`);
    },
  });
}

// ============================================================================
// Hook: useToggleModelInPreset
// ============================================================================

/**
 * Alterna o campo `enabled` de um modelo específico.
 */
export function useToggleModelInPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      model_id,
      enabled,
    }: {
      model_id: string;
      enabled: boolean;
    }) => {
      const { error } = await supabase
        .from('ai_agent_models' as never)
        .update({ enabled } as Record<string, unknown>)
        .eq('id', model_id as never);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_presets'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao alterar modelo: ${error.message}`);
    },
  });
}

// ============================================================================
// Hook: useSetDefaultModelInPreset
// ============================================================================

/**
 * Define o modelo padrão do preset via RPC atômica `set_default_model_in_preset`.
 * Substitui os 2 UPDATEs sequenciais que geravam race condition (migration 106).
 */
export function useSetDefaultModelInPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      preset_id,
      model_id,
    }: {
      preset_id: string;
      model_id: string;
    }) => {
      const { error } = await supabase.rpc(
        'set_default_model_in_preset' as never,
        { p_preset_id: preset_id, p_model_id: model_id } as never
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_presets'] });
      toast.success('Modelo padrão definido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao definir padrão: ${error.message}`);
    },
  });
}

// ============================================================================
// Hook: useAddModelToPreset
// ============================================================================

/**
 * Insere um novo modelo no preset.
 * SF-5: position é calculado como MAX(position) + 1 antes do INSERT.
 * Valida duplicata antes de inserir.
 */
export function useAddModelToPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      preset_id,
      provider,
      model_id,
    }: {
      preset_id: string;
      provider: string;
      model_id: string;
    }) => {
      // Verifica duplicata
      const { data: existing, error: checkError } = await supabase
        .from('ai_agent_models' as never)
        .select('id')
        .eq('preset_id', preset_id as never)
        .eq('model_id', model_id as never)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing) throw new Error(`Modelo "${model_id}" já está neste preset`);

      // SF-5: calcula próxima position de forma dinâmica
      const { data: maxData, error: maxError } = await supabase
        .from('ai_agent_models' as never)
        .select('position')
        .eq('preset_id', preset_id as never)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxError) throw maxError;

      const nextPosition = maxData
        ? ((maxData as Record<string, unknown>).position as number) + 1
        : 1;

      const { error } = await supabase
        .from('ai_agent_models' as never)
        .insert({
          preset_id,
          provider,
          model_id,
          enabled: true,
          is_default: false,
          position: nextPosition,
        } as Record<string, unknown>);

      if (error) throw error;

      // Audit trail B1
      void logActivity({
        type: 'create',
        entity_type: 'ai_agent_model',
        entity_name: model_id,
        entity_id: preset_id,
        description: `Modelo adicionado ao preset: ${model_id}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_presets'] });
      toast.success('Modelo adicionado ao preset');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ============================================================================
// Hook: useRemoveModelFromPreset
// ============================================================================

/**
 * Remove um modelo do preset (DELETE).
 */
export function useRemoveModelFromPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (model_id: string) => {
      const { error } = await supabase
        .from('ai_agent_models' as never)
        .delete()
        .eq('id', model_id as never);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_presets'] });
      toast.success('Modelo removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover modelo: ${error.message}`);
    },
  });
}
