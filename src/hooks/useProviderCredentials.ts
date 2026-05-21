import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

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
 * Máscara aplicada no banco (view SQL) — a chave real NUNCA trafega no payload HTTP.
 */
export interface ProviderCredentialAdmin extends ProviderStatus {
  id: string;
  /** Chave mascarada pela view SQL no banco: '•••sk-...ABCD'. Nunca a chave real. */
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
// Hook: useAdminProviderCredentials (admin — chave mascarada via view SQL)
// ============================================================================

/**
 * Lê `ai_provider_credentials_admin_view` — apenas admin.
 * A máscara da api_key é aplicada pelo banco (migration 092): a chave real
 * NUNCA trafega no payload HTTP — o campo api_key_masked já chega mascarado.
 */
export function useAdminProviderCredentials() {
  const { isAdmin } = useUserRole();

  return useQuery<ProviderCredentialAdmin[]>({
    queryKey: ['provider_credentials_admin'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_provider_credentials_admin_view' as never)
        .select('id, provider, api_key_masked, api_key_set, is_active, last_test_status, last_tested_at, created_at, updated_at')
        .order('provider');

      if (error) throw error;
      if (!data) return [];

      return (data as Array<Record<string, unknown>>).map((row) => ({
        id: row.id as string,
        provider: row.provider as AIProviderName,
        is_active: row.is_active as boolean,
        last_test_status: (row.last_test_status ?? null) as TestStatus | null,
        api_key_masked: (row.api_key_masked ?? null) as string | null,
        api_key_set: row.api_key_set as boolean,
        last_tested_at: (row.last_tested_at ?? null) as string | null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      }));
    },
    staleTime: 2 * 60 * 1000,
  });
}
