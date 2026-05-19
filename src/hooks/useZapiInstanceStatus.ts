import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface InstanceStatus {
  connected: boolean;
  /** 'CONNECTED' | 'DISCONNECTED' | 'PAIRING' | 'CONNECTING' | 'unknown' */
  state: string;
  needsQR: boolean;
}

// ─── Key Factory ─────────────────────────────────────────────────────────────

export const instanceStatusKeys = {
  byAccount: (accountId: string | null) =>
    ['zapi-instance-status', accountId] as const,
};

// ─── useZapiInstanceStatus ────────────────────────────────────────────────────

/**
 * Consulta o status de conexão de uma instância Z-API via Edge Function proxy.
 *
 * - Polling a cada 60s enquanto a aba está ativa.
 * - Desabilitado quando accountId é null.
 * - Não poleia em background (refetchIntervalInBackground: false).
 * - Retorna { connected, state, needsQR, isLoading }.
 *
 * A EF zapi-instance-status faz o proxy seguro: nunca expõe tokens ao frontend.
 *
 * Referência: RAQ-MAND-EM073 — Onda B, T27/T28
 */
export function useZapiInstanceStatus(accountId: string | null | undefined) {
  const query = useQuery<InstanceStatus>({
    queryKey: instanceStatusKeys.byAccount(accountId ?? null),
    enabled: !!accountId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<InstanceStatus> => {
      const { data, error } = await supabase.functions.invoke(
        'zapi-instance-status',
        { body: { account_id: accountId } },
      );

      if (error) {
        // Falha silenciosa: retorna estado desconhecido sem quebrar a UI
        console.warn('useZapiInstanceStatus: falha ao consultar EF', error.message);
        return { connected: false, state: 'unknown', needsQR: false };
      }

      const result = data as InstanceStatus | null;
      if (!result) {
        return { connected: false, state: 'unknown', needsQR: false };
      }

      return result;
    },
  });

  return {
    connected: query.data?.connected ?? false,
    state: query.data?.state ?? 'unknown',
    needsQR: query.data?.needsQR ?? false,
    isLoading: query.isLoading,
  };
}
