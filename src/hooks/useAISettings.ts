import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { logActivity } from '@/lib/activityLog';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// ============================================================================
// Tipos
// ============================================================================

export type AIProvider = 'anthropic' | 'openai' | 'google';

export interface AIFeatures {
  resumo_demandas: boolean;
  sugestao_acoes: boolean;
  analise_risco: boolean;
}

export interface AISettings {
  id: string;
  provider: AIProvider | null;
  model: string | null;
  /** Já vem mascarada (ex: `sk-••••••••••••ABCD`) ou null para não-admin. */
  api_key: string | null;
  /** Indica se há uma chave salva, sem expor o valor. */
  api_key_set: boolean;
  ai_enabled: boolean;
  features: AIFeatures;
  updated_by: string | null;
  updated_at: string;
}

export interface AISettingsUpdate {
  provider?: AIProvider | null;
  model?: string | null;
  /** Quando undefined, mantém a chave existente. String vazia limpa. */
  api_key?: string | null;
  ai_enabled?: boolean;
  features?: AIFeatures;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Mascara uma chave deixando os 3 primeiros e 4 últimos caracteres visíveis.
 * Nunca retorna a chave real para o frontend.
 */
export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(8);
  return `${key.slice(0, 3)}${'•'.repeat(12)}${key.slice(-4)}`;
}

const DEFAULT_FEATURES: AIFeatures = {
  resumo_demandas: false,
  sugestao_acoes: false,
  analise_risco: false,
};

// ============================================================================
// Query
// ============================================================================

/**
 * Lê a linha singleton de `ai_settings`. RLS já restringe SELECT a admins
 * ATIVOS — não-admin recebe `null`. Mesmo assim, o hook nunca devolve a chave
 * real ao componente: `api_key` vem mascarado e `api_key_set` indica presença.
 */
export function useAISettings() {
  const { isAdmin } = useUserRole();

  return useQuery<AISettings | null>({
    queryKey: ['ai_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const features = (data.features ?? {}) as Partial<AIFeatures>;

      return {
        id: data.id,
        provider: (data.provider ?? null) as AIProvider | null,
        model: data.model ?? null,
        api_key: isAdmin && data.api_key ? maskKey(data.api_key) : null,
        api_key_set: !!data.api_key,
        ai_enabled: data.ai_enabled,
        features: {
          resumo_demandas: !!features.resumo_demandas,
          sugestao_acoes: !!features.sugestao_acoes,
          analise_risco: !!features.analise_risco,
        },
        updated_by: data.updated_by,
        updated_at: data.updated_at,
      };
    },
  });
}

// ============================================================================
// Mutation
// ============================================================================

export function useUpdateAISettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: AISettingsUpdate }) => {
      const payload: Record<string, unknown> = {
        updated_by: user?.id ?? null,
      };

      if (patch.provider !== undefined) payload.provider = patch.provider;
      if (patch.model !== undefined) payload.model = patch.model;
      if (patch.api_key !== undefined) payload.api_key = patch.api_key;
      if (patch.ai_enabled !== undefined) payload.ai_enabled = patch.ai_enabled;
      if (patch.features !== undefined) {
        payload.features = patch.features as unknown as Json;
      }

      const { data, error } = await supabase
        .from('ai_settings')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai_settings'] });
      toast.success('Configuração de IA atualizada');
      // Audit log obrigatório (issue 14 A.5) — NUNCA incluir a chave em si
      logActivity({
        type: 'update',
        entity_type: 'ai_settings',
        entity_id: data.id,
        description: 'Configuração de IA alterada',
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });
}

export { DEFAULT_FEATURES };
