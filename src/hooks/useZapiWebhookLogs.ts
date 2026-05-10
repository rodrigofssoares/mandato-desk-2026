import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type ZapiWebhookLog = Tables<'zapi_webhook_log'>;

export interface ZapiWebhookLogsFilters {
  account_id?: string | null;
  event_type?: string | null;
  page?: number;
}

const PAGE_SIZE = 50;

export const zapiWebhookLogKeys = {
  all: ['zapi-webhook-logs'] as const,
  list: (filters: ZapiWebhookLogsFilters) =>
    ['zapi-webhook-logs', filters.account_id ?? '_', filters.event_type ?? '_', filters.page ?? 0] as const,
};

/**
 * Lista paginada de logs de webhook Z-API com filtros opcionais.
 * Retorna { data, count, page, hasMore } — UI pagina via botões Anterior/Próxima.
 *
 * Apenas admin deveria consumir este hook (gating no componente).
 * RLS permite SELECT pra qualquer auth, mas a aba Logs gate-keepa.
 */
export function useZapiWebhookLogs(filters: ZapiWebhookLogsFilters, enabled: boolean) {
  const page = filters.page ?? 0;

  return useQuery({
    queryKey: zapiWebhookLogKeys.list(filters),
    enabled,
    queryFn: async () => {
      let query = supabase
        .from('zapi_webhook_log')
        .select('*', { count: 'exact' })
        .order('received_at', { ascending: false });

      if (filters.account_id) query = query.eq('account_id', filters.account_id);
      if (filters.event_type) query = query.eq('event_type', filters.event_type);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const total = count ?? 0;
      return {
        data: (data ?? []) as ZapiWebhookLog[],
        count: total,
        page,
        hasMore: from + (data?.length ?? 0) < total,
        pageSize: PAGE_SIZE,
      };
    },
  });
}
