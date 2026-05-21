import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';
import type { AIProviderName } from '@/hooks/useProviderCredentials';

// ============================================================================
// Hook: useUpsertProviderCredential
// ============================================================================

/**
 * UPSERT em `ai_provider_credentials`.
 * Campos aceitos: provider, api_key, is_active.
 * api_key nunca é logada nos changes.
 */
export function useUpsertProviderCredential() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      api_key,
      is_active,
    }: {
      provider: AIProviderName;
      api_key: string;
      is_active?: boolean;
    }) => {
      const { error } = await supabase
        .from('ai_provider_credentials' as never)
        .upsert(
          {
            provider,
            api_key,
            is_active: is_active ?? true,
            last_tested_at: new Date().toISOString(),
            last_test_status: 'valid',
          } as Record<string, unknown>,
          { onConflict: 'provider' }
        );

      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['provider_credentials_admin'] });
      queryClient.invalidateQueries({ queryKey: ['provider_credentials_public'] });

      void logActivity({
        type: 'update',
        entity_type: 'ai_settings',
        entity_name: `Credencial ${variables.provider}`,
        description: `Credencial do provider ${variables.provider} atualizada`,
      });

      toast.success('Chave API salva');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar chave: ${error.message}`);
    },
  });
}

// ============================================================================
// Hook: useTestProviderKey
// ============================================================================

/**
 * Chama a Edge Function `ai-test-provider-key` para validar a chave antes de salvar.
 * Em sucesso retorna `{ ok: true }`. Em falha, retorna `{ ok: false, error: string }`.
 */
export function useTestProviderKey() {
  return useMutation({
    mutationFn: async ({
      provider,
      api_key,
    }: {
      provider: AIProviderName;
      api_key: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-test-provider-key', {
        body: { provider, api_key },
      });

      // supabase-js encapsula non-2xx em FunctionsHttpError mas oculta o body.
      // Lemos o body manualmente pra mostrar mensagem útil ao usuário.
      if (error) {
        let detail = error.message;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx instanceof Response) {
            const body = await ctx.json().catch(() => null);
            if (body?.error) detail = body.error;
          }
        } catch { /* ignora */ }
        throw new Error(detail);
      }

      const result = data as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? 'Chave inválida');
      }

      return result;
    },
    onError: (error: Error) => {
      toast.error(`Chave inválida: ${error.message}`);
    },
  });
}
