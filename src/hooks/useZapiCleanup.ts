import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { zapiChatKeys } from '@/hooks/useZapiChats';

// ─── Tipos exportados (compartilhados com T06/T07) ───────────────────────────

export type CleanupMode = 'period' | 'all' | 'chats' | 'granular';

export type GranularItem = 'messages' | 'notes' | 'tags' | 'flags' | 'logs';

export interface CleanupFilters {
  /** Modo 'period': data de início em ISO8601 */
  start_date?: string;
  /** Modo 'period': data de fim em ISO8601 */
  end_date?: string;
  /** Modos 'chats' e 'granular': lista de UUIDs dos chats */
  chat_ids?: string[];
  /** Modo 'granular': quais tipos de itens apagar */
  items?: GranularItem[];
}

export interface CleanupInput {
  mode: CleanupMode;
  filters: CleanupFilters;
}

export interface CleanupResult {
  ok: true;
  batch_id: string;
  row_count: number;
  expires_at: string;
}

// ─── Key factory ─────────────────────────────────────────────────────────────

export const zapiCleanupKeys = {
  all: ['zapi-cleanup-batches'] as const,
  pending: () => ['zapi-cleanup-batches', 'pending'] as const,
};

// ─── useZapiCleanup ───────────────────────────────────────────────────────────

/**
 * EM082 — Mutation para limpar histórico de conversas de uma conta Z-API.
 *
 * Invoca a Edge Function `zapi-cleanup-history` com { account_id, mode, filters }.
 * Em sucesso:
 *   - Invalida a lista de chats da conta (removed from view)
 *   - Invalida a lista de batches de limpeza (atualiza painel lixeira)
 *   - Exibe toast de sucesso com row_count
 *
 * @param accountId UUID da conta Z-API a ser limpa
 */
export function useZapiCleanup(accountId: string) {
  const queryClient = useQueryClient();

  const cleanupMutation = useMutation<CleanupResult, Error, CleanupInput>({
    mutationFn: async ({ mode, filters }) => {
      const { data, error } = await supabase.functions.invoke<CleanupResult>(
        'zapi-cleanup-history',
        {
          body: { account_id: accountId, mode, filters },
        },
      );

      if (error) {
        // Tentar extrair mensagem de erro do body da EF (4xx/5xx)
        const ctx = (error as unknown as { context?: { json?: () => Promise<unknown> } }).context;
        if (ctx?.json) {
          try {
            const errBody = await ctx.json();
            if (errBody && typeof errBody === 'object' && 'error' in errBody) {
              throw new Error(String((errBody as { error: unknown }).error));
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== error.message) {
              throw parseErr;
            }
          }
        }
        throw new Error(error.message || 'Falha ao limpar histórico');
      }

      if (!data || !data.ok) {
        throw new Error('Resposta inválida da Edge Function');
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalida lista de chats da conta (chats soft-deletados somem da UI)
      queryClient.invalidateQueries({ queryKey: zapiChatKeys.byAccount(accountId) });
      queryClient.invalidateQueries({ queryKey: zapiChatKeys.all });
      // Invalida painel de lixeira para refletir o novo batch
      queryClient.invalidateQueries({ queryKey: zapiCleanupKeys.all });

      const count = data.row_count ?? 0;
      toast.success(
        `${count} ${count === 1 ? 'item enviado' : 'itens enviados'} para a lixeira. Recuperação disponível por 7 dias.`,
      );
    },
    onError: (err) => {
      toast.error(err.message || 'Erro ao limpar histórico');
    },
  });

  return { cleanupMutation };
}
