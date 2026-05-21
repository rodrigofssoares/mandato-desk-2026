import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Dados completos do agente — acessíveis apenas por admin.
 * system_prompt nunca chega ao frontend de não-admin.
 */
export interface AgentSettings {
  id: string;
  name: string;
  system_prompt: string | null;
  is_active: boolean;
  text_only_mode: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Visão pública do agente — disponível a todos os usuários autenticados.
 * Usada para verificar se o agente está ativo e exibir o nome na UI.
 */
export interface AgentPublicInfo {
  id: string;
  name: string;
  is_active: boolean;
}

// ============================================================================
// Hook: useAgentSettings
// ============================================================================

/**
 * Lê a linha singleton de `ai_agents`.
 *
 * - Admin: lê a tabela direta (dados completos, incluindo system_prompt).
 * - Não-admin: lê `ai_agents_public_view` (apenas id, name, is_active).
 *
 * Retorna null quando não há agente configurado.
 * Mutations vêm na Onda 3 (sub-aba Settings).
 */
export function useAgentSettings() {
  const { isAdmin } = useUserRole();

  return useQuery<AgentSettings | AgentPublicInfo | null>({
    queryKey: ['agent_settings', isAdmin],
    queryFn: async () => {
      if (isAdmin) {
        // Admin lê dados completos diretamente da tabela
        const { data, error } = await supabase
          .from('ai_agents' as never)
          .select('id, name, system_prompt, is_active, text_only_mode, created_by, updated_by, created_at, updated_at')
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        const row = data as Record<string, unknown>;
        return {
          id: row.id as string,
          name: row.name as string,
          system_prompt: (row.system_prompt ?? null) as string | null,
          is_active: row.is_active as boolean,
          text_only_mode: row.text_only_mode as boolean,
          created_by: (row.created_by ?? null) as string | null,
          updated_by: (row.updated_by ?? null) as string | null,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
        } satisfies AgentSettings;
      }

      // Usuário comum lê apenas a view pública (sem system_prompt)
      const { data, error } = await supabase
        .from('ai_agents_public_view' as never)
        .select('id, name, is_active')
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const row = data as Record<string, unknown>;
      return {
        id: row.id as string,
        name: row.name as string,
        is_active: row.is_active as boolean,
      } satisfies AgentPublicInfo;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos — configuração raramente muda
  });
}

// ============================================================================
// Type guard
// ============================================================================

/** Verifica se o dado retornado tem acesso admin completo. */
export function isFullAgentSettings(
  data: AgentSettings | AgentPublicInfo | null | undefined
): data is AgentSettings {
  return !!data && 'system_prompt' in data;
}
