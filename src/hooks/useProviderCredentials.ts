import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { maskKey } from '@/hooks/useAISettings';

// ============================================================================
// Tipos
// ============================================================================

export type AIProviderName = 'openai' | 'anthropic' | 'openrouter';
export type TestStatus = 'valid' | 'invalid' | 'untested';

/**
 * Dados de status público do provider — sem a chave de API.
 * Disponível para qualquer usuário autenticado via view pública.
 */
export interface ProviderStatus {
  provider: AIProviderName;
  is_active: boolean;
  last_test_status: TestStatus | null;
}

/**
 * Dados de admin — chave mascarada incluída.
 * A chave NUNCA chega ao frontend em texto puro: usa maskKey() do useAISettings.
 */
export interface ProviderCredentialAdmin extends ProviderStatus {
  id: string;
  /** Chave mascarada: 'sk-•••••••••••••ABCD'. Nunca a chave real. */
  api_key_masked: string | null;
  /** Indica se há chave configurada, mesmo sem o valor mascarado. */
  api_key_set: boolean;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Hook: useProviderCredentials (público — status sem chave)
// ============================================================================

/**
 * Lê `ai_provider_credentials_public_view`.
 * Disponível para todos os usuários autenticados.
 * Útil para a UI mostrar quais providers estão configurados/válidos.
 */
export function useProviderCredentials() {
  return useQuery<ProviderStatus[]>({
    queryKey: ['provider_credentials_public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_provider_credentials_public_view' as never)
        .select('provider, is_active, last_test_status');

      if (error) throw error;
      if (!data) return [];

      return (data as Array<Record<string, unknown>>).map((row) => ({
        provider: row.provider as AIProviderName,
        is_active: row.is_active as boolean,
        last_test_status: (row.last_test_status ?? null) as TestStatus | null,
      }));
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

// ============================================================================
// Hook: useAdminProviderCredentials (admin — chave mascarada)
// ============================================================================

/**
 * Lê a tabela `ai_provider_credentials` diretamente — apenas admin.
 * A api_key é mascarada no frontend usando maskKey() do useAISettings.
 * A chave real NUNCA é retornada ao componente.
 */
export function useAdminProviderCredentials() {
  const { isAdmin } = useUserRole();

  return useQuery<ProviderCredentialAdmin[]>({
    queryKey: ['provider_credentials_admin'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_provider_credentials' as never)
        .select('id, provider, api_key, is_active, last_test_status, last_tested_at, created_at, updated_at')
        .order('provider');

      if (error) throw error;
      if (!data) return [];

      return (data as Array<Record<string, unknown>>).map((row) => {
        const rawKey = row.api_key as string | null;
        return {
          id: row.id as string,
          provider: row.provider as AIProviderName,
          is_active: row.is_active as boolean,
          last_test_status: (row.last_test_status ?? null) as TestStatus | null,
          api_key_masked: rawKey ? maskKey(rawKey) : null,
          api_key_set: !!rawKey,
          last_tested_at: (row.last_tested_at ?? null) as string | null,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
        };
      });
    },
    staleTime: 2 * 60 * 1000,
  });
}
