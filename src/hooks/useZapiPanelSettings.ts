import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ZapiPanelSettings {
  requirePasswordForPrivileged: boolean;
}

export interface UpdateZapiPanelSettingsInput {
  require_password_for_privileged: boolean;
}

// ─── Key Factory ────────────────────────────────────────────────────────────

export const zapiPanelSettingsKeys = {
  all: ['zapi-panel-settings'] as const,
  singleton: () => [...zapiPanelSettingsKeys.all, 'singleton'] as const,
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function sanitizeError(error: Error, fallback: string): string {
  const msg = error.message ?? '';
  if (/row-level security|permission denied|new row violates/i.test(msg)) {
    return 'Você não tem permissão para esta operação. Contate o administrador.';
  }
  return `${fallback}: ${msg}`;
}

// ─── useZapiPanelSettings ────────────────────────────────────────────────────

/**
 * Lê o singleton de configurações globais do painel WhatsApp.
 * Retorna { requirePasswordForPrivileged: false } em caso de erro ou ausência
 * de dados (default seguro — privilegiado não precisa de senha por padrão).
 */
export function useZapiPanelSettings() {
  return useQuery({
    queryKey: zapiPanelSettingsKeys.singleton(),
    queryFn: async (): Promise<ZapiPanelSettings> => {
      const { data, error } = await supabase
        .from('zapi_panel_settings')
        .select('require_password_for_privileged')
        .eq('id', true)
        .maybeSingle();

      if (error) {
        // Fail-open intencional (Security B-02): se o usuário não tem permissão de ler
        // zapi_panel_settings, assume requirePasswordForPrivileged=false (não bloqueia
        // privilegiados sem senha). A defesa real é o RLS em zapi_chats/zapi_messages —
        // a policy de SELECT não afeta o gate de conteúdo das conversas.
        if (/permission denied|row-level security/i.test(error.message)) {
          return { requirePasswordForPrivileged: false };
        }
        throw error;
      }

      return {
        requirePasswordForPrivileged: data?.require_password_for_privileged ?? false,
      };
    },
    // Configurações raramente mudam — stale de 1 min é suficiente
    staleTime: 60_000,
  });
}

// ─── useUpdateZapiPanelSettings ──────────────────────────────────────────────

/**
 * Atualiza o toggle global do painel WhatsApp.
 * Admin-only: RLS enforce server-side. Toast de erro sanitizado pra não-admin.
 */
export function useUpdateZapiPanelSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateZapiPanelSettingsInput) => {
      const { data: sessionData } = await supabase.auth.getUser();
      const userId = sessionData.user?.id ?? null;

      const { error } = await supabase
        .from('zapi_panel_settings')
        .update({
          require_password_for_privileged: input.require_password_for_privileged,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq('id', true);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zapiPanelSettingsKeys.all });
      toast.success('Configuração atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error, 'Erro ao atualizar configuração'));
    },
  });
}
