import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type ZapiAccountUser = Pick<Tables<'zapi_account_users'>, 'id' | 'account_id' | 'user_id'>;

export interface ToggleAccountUserBindingInput {
  account_id: string;
  user_id: string;
  linked: boolean;
}

// ─── Key Factory ────────────────────────────────────────────────────────────

export const zapiAccountUserKeys = {
  all: ['zapi-account-users'] as const,
  list: () => [...zapiAccountUserKeys.all, 'list'] as const,
  byUser: (userId: string) => [...zapiAccountUserKeys.all, 'user', userId] as const,
};

// ─── Helper ─────────────────────────────────────────────────────────────────

/**
 * Normaliza mensagens de erro pra não vazar detalhes do schema (RLS, nomes de tabela).
 */
function sanitizeError(error: Error, fallback: string): string {
  const msg = error.message ?? '';
  if (/row-level security|permission denied|new row violates/i.test(msg)) {
    return 'Você não tem permissão para esta operação. Contate o administrador.';
  }
  return `${fallback}: ${msg}`;
}

// ─── useZapiAccountUsers ─────────────────────────────────────────────────────

/**
 * Lista TODOS os vínculos conta↔usuário.
 * Admin/privilegiado recebe todos via RLS. Restrito recebe apenas os próprios.
 */
export function useZapiAccountUsers() {
  return useQuery({
    queryKey: zapiAccountUserKeys.list(),
    queryFn: async (): Promise<ZapiAccountUser[]> => {
      const { data, error } = await supabase
        .from('zapi_account_users')
        .select('id, account_id, user_id');

      if (error) {
        // RLS bloqueia → retorna vazio silenciosamente
        if (/permission denied|row-level security/i.test(error.message)) {
          return [];
        }
        throw error;
      }
      return data ?? [];
    },
  });
}

// ─── useToggleAccountUserBinding ─────────────────────────────────────────────

/**
 * Vincula ou desvincula uma conta Z-API de um usuário.
 * - linked=true → INSERT com upsert/onConflict ignore (UNIQUE account_id,user_id)
 * - linked=false → DELETE WHERE account_id AND user_id
 * Invalida a query de vínculos após cada operação.
 */
export function useToggleAccountUserBinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ToggleAccountUserBindingInput) => {
      if (input.linked) {
        // created_by é omitido: o trigger force_created_by (migration 111) sobrescreve
        // server-side com auth.uid() — roundtrip desnecessário eliminado (CR-3).
        const { error } = await supabase
          .from('zapi_account_users')
          .upsert(
            {
              account_id: input.account_id,
              user_id: input.user_id,
            },
            { onConflict: 'account_id,user_id', ignoreDuplicates: true },
          );

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('zapi_account_users')
          .delete()
          .eq('account_id', input.account_id)
          .eq('user_id', input.user_id);

        if (error) throw error;
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: zapiAccountUserKeys.all });
      if (input.linked) {
        toast.success('Conta vinculada ao usuário com sucesso');
      } else {
        toast.success('Vínculo removido com sucesso');
      }
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error, 'Erro ao alterar vínculo'));
    },
  });
}
