import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Alert } from '@/hooks/useDashboardMetrics';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DismissedAlert {
  id: string;
  alert_key: string;
  alert_type: string;
  alert_title: string | null;
  alert_subtitle: string | null;
  dismissed_at: string;
  expires_at: string;
}

export interface UseDismissedAlertsReturn {
  /** Conjunto de alert_keys dispensados pelo usuário atual. */
  dismissedKeys: Set<string>;
  /** Lista completa de dismissals, ordenada por dismissed_at DESC — para tela de Configurações. */
  dismissedList: DismissedAlert[];
  /** Dispensa um único alerta. Sem confirmação — baixo atrito. */
  dismissOne: (alert: Pick<Alert, 'id' | 'type' | 'title' | 'subtitle'>) => Promise<void>;
  /** Dispensa múltiplos alertas em lote (insert upsert). */
  dismissMany: (alerts: Pick<Alert, 'id' | 'type' | 'title' | 'subtitle'>[]) => Promise<void>;
  /** Restaura um único alerta dispensado. */
  restoreOne: (alertKey: string) => Promise<void>;
  /** Restaura todos os alertas dispensados do usuário. */
  restoreAll: () => Promise<void>;
  /** Apaga um único dismissal permanentemente. */
  deleteOne: (alertKey: string) => Promise<void>;
  /** Apaga todos os dismissals do usuário permanentemente. */
  deleteAll: () => Promise<void>;
  /** Apaga apenas dismissals expirados (expires_at <= NOW()). */
  deleteExpired: () => Promise<void>;
  isLoading: boolean;
}

// ─── Query key ────────────────────────────────────────────────────────────────

const DISMISSED_QUERY_KEY = ['dismissedAlerts'] as const;

// Cap defensivo do tamanho de lote (Security M3) — protege contra DoS por
// payload gigante. O dashboard naturalmente exibe <50 alertas, então 200 dá
// folga sem permitir abuso.
const MAX_BATCH_SIZE = 200;

// ─── Helper: busca o user_id atual ───────────────────────────────────────────

async function getCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Usuário não autenticado');
  return user.id;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useDismissedAlerts(): UseDismissedAlertsReturn {
  const queryClient = useQueryClient();

  // ── Query: lista todos os dismissals do usuário ──────────────────────────
  const { data: rows = [], isLoading } = useQuery<DismissedAlert[]>({
    queryKey: DISMISSED_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_alert_dismissals')
        .select('id, alert_key, alert_type, alert_title, alert_subtitle, dismissed_at, expires_at')
        .order('dismissed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DismissedAlert[];
    },
    staleTime: 30_000,
  });

  // useMemo garante referência estável do Set entre renders quando rows não muda.
  // Filtra apenas dismissals ATIVOS (expires_at > NOW()) — registros expirados são
  // excluídos do Set para que o alerta volte a aparecer no dashboard naturalmente.
  // O filtro é calculado uma vez no render via Date.now(); atualiza na próxima
  // revalidação da query (staleTime: 30s). NÃO há setInterval — simples e suficiente.
  const dismissedKeys = useMemo(() => {
    const now = Date.now();
    return new Set(
      rows
        .filter((r) => new Date(r.expires_at).getTime() > now)
        .map((r) => r.alert_key)
    );
  }, [rows]);

  // ── Mutation: dismissOne ─────────────────────────────────────────────────
  const dismissOneMutation = useMutation({
    mutationFn: async (alert: Pick<Alert, 'id' | 'type' | 'title' | 'subtitle'>) => {
      const userId = await getCurrentUserId();
      const { error } = await supabase
        .from('dashboard_alert_dismissals')
        .upsert(
          {
            user_id: userId,
            alert_key: alert.id,
            alert_type: alert.type,
            alert_title: alert.title,
            alert_subtitle: alert.subtitle,
          },
          { onConflict: 'user_id,alert_key', ignoreDuplicates: true }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      toast.success('Alerta dispensado');
    },
    onError: () => {
      toast.error('Falha ao dispensar alerta');
    },
  });

  // ── Mutation: dismissMany (lote) ─────────────────────────────────────────
  const dismissManyMutation = useMutation({
    mutationFn: async (alerts: Pick<Alert, 'id' | 'type' | 'title' | 'subtitle'>[]) => {
      if (alerts.length === 0) return;
      const userId = await getCurrentUserId();
      const capped = alerts.slice(0, MAX_BATCH_SIZE);
      const rows = capped.map((a) => ({
        user_id: userId,
        alert_key: a.id,
        alert_type: a.type,
        alert_title: a.title,
        alert_subtitle: a.subtitle,
      }));
      const { error } = await supabase
        .from('dashboard_alert_dismissals')
        .upsert(rows, { onConflict: 'user_id,alert_key', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_, alerts) => {
      queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      // Usa min(alerts.length, MAX_BATCH_SIZE) — em caso de cap, reflete o que foi
      // efetivamente persistido, não o tamanho original do array (CR should-fix).
      const sent = Math.min(alerts.length, MAX_BATCH_SIZE);
      toast.success(`${sent} alerta${sent === 1 ? '' : 's'} dispensado${sent === 1 ? '' : 's'}`);
    },
    onError: () => {
      toast.error('Falha ao dispensar alertas');
    },
  });

  // ── Mutation: restoreOne ─────────────────────────────────────────────────
  const restoreOneMutation = useMutation({
    mutationFn: async (alertKey: string) => {
      const userId = await getCurrentUserId();
      const { error } = await supabase
        .from('dashboard_alert_dismissals')
        .delete()
        .eq('user_id', userId)
        .eq('alert_key', alertKey);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      toast.success('Alerta restaurado');
    },
    onError: () => {
      toast.error('Falha ao restaurar alerta');
    },
  });

  // ── Mutation: restoreAll ─────────────────────────────────────────────────
  const restoreAllMutation = useMutation({
    mutationFn: async () => {
      const userId = await getCurrentUserId();
      const { error } = await supabase
        .from('dashboard_alert_dismissals')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      toast.success('Todos os alertas restaurados');
    },
    onError: () => {
      toast.error('Falha ao restaurar alertas');
    },
  });

  // ── Mutation: deleteOne ──────────────────────────────────────────────────
  const deleteOneMutation = useMutation({
    mutationFn: async (alertKey: string) => {
      const userId = await getCurrentUserId();
      const { error } = await supabase
        .from('dashboard_alert_dismissals')
        .delete()
        .eq('user_id', userId)
        .eq('alert_key', alertKey);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      toast.success('Alerta apagado');
    },
    onError: () => {
      toast.error('Falha ao apagar alerta');
    },
  });

  // ── Mutation: deleteAll ──────────────────────────────────────────────────
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const userId = await getCurrentUserId();
      const { error } = await supabase
        .from('dashboard_alert_dismissals')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      toast.success('Todos os alertas apagados');
    },
    onError: () => {
      toast.error('Falha ao apagar alertas');
    },
  });

  // ── Mutation: deleteExpired ──────────────────────────────────────────────
  const deleteExpiredMutation = useMutation({
    mutationFn: async () => {
      const userId = await getCurrentUserId();
      const { error, count } = await supabase
        .from('dashboard_alert_dismissals')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
        .lte('expires_at', new Date().toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      toast.success(`${count} alerta${count === 1 ? '' : 's'} antigo${count === 1 ? '' : 's'} apagado${count === 1 ? '' : 's'}`);
    },
    onError: () => {
      toast.error('Falha ao apagar alertas expirados');
    },
  });

  return {
    dismissedKeys,
    dismissedList: rows,
    dismissOne: (alert) => dismissOneMutation.mutateAsync(alert),
    dismissMany: (alerts) => dismissManyMutation.mutateAsync(alerts),
    restoreOne: (key) => restoreOneMutation.mutateAsync(key),
    restoreAll: () => restoreAllMutation.mutateAsync(),
    deleteOne: (key) => deleteOneMutation.mutateAsync(key),
    deleteAll: () => deleteAllMutation.mutateAsync(),
    deleteExpired: async () => {
      await deleteExpiredMutation.mutateAsync();
    },
    isLoading,
  };
}
