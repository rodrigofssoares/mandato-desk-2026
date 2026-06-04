import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { zapiChatKeys } from '@/hooks/useZapiChats';
import { zapiCleanupKeys, type CleanupMode, type CleanupFilters } from '@/hooks/useZapiCleanup';

// ─── Tipos exportados ─────────────────────────────────────────────────────────

/**
 * Representa um lote de limpeza registrado em `zapi_cleanup_batches`.
 *
 * Os campos do banco espelham `Tables<'zapi_cleanup_batches'>` (types.ts regenerado
 * após a migration 112). Mantido como interface explícita para tipar `mode`/`filters`/
 * `status` de forma mais estreita e carregar os campos enriquecidos no componente.
 */
export interface CleanupBatch {
  id: string;
  account_id: string;
  initiated_by: string;
  mode: CleanupMode;
  filters: CleanupFilters;
  status: 'pending' | 'restored' | 'expired';
  row_count_estimate: number | null;
  created_at: string;
  expires_at: string;
  // Campos enriquecidos via JOIN/lookup no componente (não vêm do banco diretamente)
  initiator_name?: string | null;
  account_name?: string | null;
}

export interface RestoreResult {
  ok: true;
  restored_count: number;
}

// ─── useZapiTrash ─────────────────────────────────────────────────────────────

/**
 * EM082 — Hook de lixeira: lista lotes de limpeza + mutation de restauração.
 *
 * `batchesQuery`: lista todos os batches (pending, restored, expired) ordenados
 *   por created_at DESC. RLS restringe a `is_zapi_privileged` (admin/proprietário).
 *
 * `restoreMutation`: invoca a EF `zapi-restore-history` com { batch_id }.
 *   Em sucesso: invalida lista de batches + lista de chats da conta restaurada.
 */
export function useZapiTrash() {
  const queryClient = useQueryClient();

  // ─── Query: lista todos os batches ───────────────────────────────────────

  const batchesQuery = useQuery<CleanupBatch[]>({
    queryKey: zapiCleanupKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zapi_cleanup_batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as CleanupBatch[];
    },
    staleTime: 30_000,
  });

  // ─── Mutation: restaurar lote ─────────────────────────────────────────────

  const restoreMutation = useMutation<RestoreResult, Error, { batch_id: string }>({
    mutationFn: async ({ batch_id }) => {
      const { data, error } = await supabase.functions.invoke<RestoreResult>(
        'zapi-restore-history',
        {
          body: { batch_id },
        },
      );

      if (error) {
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
        throw new Error(error.message || 'Falha ao restaurar histórico');
      }

      if (!data || !data.ok) {
        throw new Error('Resposta inválida da Edge Function');
      }

      return data;
    },
    onSuccess: (data, _variables) => {
      // Invalida lista de batches (status muda para 'restored')
      queryClient.invalidateQueries({ queryKey: zapiCleanupKeys.all });

      // Invalida lista de chats de todas as contas (chats restaurados voltam a aparecer)
      queryClient.invalidateQueries({ queryKey: zapiChatKeys.all });

      const count = data.restored_count ?? 0;
      toast.success(
        `Histórico restaurado com sucesso. ${count} ${count === 1 ? 'item recuperado' : 'itens recuperados'}.`,
      );
    },
    onError: (err) => {
      toast.error(err.message || 'Erro ao restaurar histórico');
    },
  });

  return { batchesQuery, restoreMutation };
}
