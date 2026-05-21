import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PresetKey } from '@/hooks/useAgentPresets';

// ============================================================================
// Hook: useSetActivePreset
// ============================================================================

/**
 * Marca is_active_preset=true no preset escolhido e false nos demais.
 * Opera via 2 UPDATEs em sequência.
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
      // 1. Desativa todos os presets do agente
      const { error: clearError } = await supabase
        .from('ai_agent_model_presets' as never)
        .update({ is_active_preset: false } as Record<string, unknown>)
        .eq('agent_id', agent_id as never);

      if (clearError) throw clearError;

      // 2. Ativa o preset escolhido
      const { error: activateError } = await supabase
        .from('ai_agent_model_presets' as never)
        .update({ is_active_preset: true } as Record<string, unknown>)
        .eq('agent_id', agent_id as never)
        .eq('preset_key', preset_key as never);

      if (activateError) throw activateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_presets'] });
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
 * Marca is_default=true no modelo escolhido e false nos demais do mesmo preset.
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
      // 1. Desmarca todos do preset
      const { error: clearError } = await supabase
        .from('ai_agent_models' as never)
        .update({ is_default: false } as Record<string, unknown>)
        .eq('preset_id', preset_id as never);

      if (clearError) throw clearError;

      // 2. Marca o escolhido
      const { error: markError } = await supabase
        .from('ai_agent_models' as never)
        .update({ is_default: true } as Record<string, unknown>)
        .eq('id', model_id as never);

      if (markError) throw markError;
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

      const { error } = await supabase
        .from('ai_agent_models' as never)
        .insert({
          preset_id,
          provider,
          model_id,
          enabled: true,
          is_default: false,
          position: 99,
        } as Record<string, unknown>);

      if (error) throw error;
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
