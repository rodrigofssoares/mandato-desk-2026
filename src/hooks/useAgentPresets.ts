import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

// ============================================================================
// Tipos
// ============================================================================

export type PresetKey = 'econ' | 'bal' | 'pre' | 'custom';

export interface AgentModel {
  id: string;
  provider: string;
  model_id: string;
  enabled: boolean;
  is_default: boolean;
  position: number;
}

export interface AgentPreset {
  id: string;
  agent_id: string;
  preset_key: PresetKey;
  is_active_preset: boolean;
  models: AgentModel[];
}

/** Label legível para exibição na UI */
export const PRESET_LABELS: Record<PresetKey, string> = {
  econ:   'Econômico',
  bal:    'Balanceado',
  pre:    'Premium',
  custom: 'Personalizado',
};

/** Emoji/ícone associado a cada preset */
export const PRESET_ICONS: Record<PresetKey, string> = {
  econ:   '🪙',
  bal:    '⚖️',
  pre:    '✨',
  custom: '🔧',
};

// ============================================================================
// Hook: useAgentPresets
// ============================================================================

/**
 * Lê os presets de modelos do agente junto com seus modelos filhos.
 * Apenas admin tem acesso (RLS).
 *
 * Retorna lista ordenada: econ → bal → pre → custom.
 * Mutations (ativar preset, toggle modelo, adicionar modelo) vêm na Onda 3.
 */
export function useAgentPresets() {
  const { isAdmin } = useUserRole();

  return useQuery<AgentPreset[]>({
    queryKey: ['agent_presets'],
    enabled: isAdmin,
    queryFn: async () => {
      // Busca presets com modelos via JOIN manual (2 queries — Supabase client
      // não suporta nested select em tabelas sem FK declarada no schema types)
      const { data: presets, error: presetsError } = await supabase
        .from('ai_agent_model_presets' as never)
        .select('id, agent_id, preset_key, is_active_preset')
        .order('preset_key');

      if (presetsError) throw presetsError;
      if (!presets || (presets as unknown[]).length === 0) return [];

      const presetRows = presets as Array<Record<string, unknown>>;
      const presetIds = presetRows.map((p) => p.id as string);

      const { data: models, error: modelsError } = await supabase
        .from('ai_agent_models' as never)
        .select('id, preset_id, provider, model_id, enabled, is_default, position')
        .in('preset_id', presetIds)
        .order('position');

      if (modelsError) throw modelsError;

      const modelRows = (models ?? []) as Array<Record<string, unknown>>;

      // Agrupa modelos por preset_id
      const modelsByPreset = modelRows.reduce<Record<string, AgentModel[]>>(
        (acc, m) => {
          const pid = m.preset_id as string;
          if (!acc[pid]) acc[pid] = [];
          acc[pid].push({
            id: m.id as string,
            provider: m.provider as string,
            model_id: m.model_id as string,
            enabled: m.enabled as boolean,
            is_default: m.is_default as boolean,
            position: m.position as number,
          });
          return acc;
        },
        {}
      );

      // Ordem de exibição definida
      const ORDER: PresetKey[] = ['econ', 'bal', 'pre', 'custom'];

      const result = presetRows.map((p): AgentPreset => ({
        id: p.id as string,
        agent_id: p.agent_id as string,
        preset_key: p.preset_key as PresetKey,
        is_active_preset: p.is_active_preset as boolean,
        models: modelsByPreset[p.id as string] ?? [],
      }));

      // Ordena pelos enum keys definidos
      return result.sort(
        (a, b) => ORDER.indexOf(a.preset_key) - ORDER.indexOf(b.preset_key)
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Helpers de leitura
// ============================================================================

/** Retorna o preset atualmente ativo. */
export function getActivePreset(presets: AgentPreset[]): AgentPreset | undefined {
  return presets.find((p) => p.is_active_preset);
}

/** Retorna o modelo default do preset ativo. */
export function getDefaultModel(presets: AgentPreset[]): AgentModel | undefined {
  const active = getActivePreset(presets);
  if (!active) return undefined;
  return active.models.find((m) => m.is_default && m.enabled);
}
