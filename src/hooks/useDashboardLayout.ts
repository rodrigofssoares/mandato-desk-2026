import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_LAYOUTS,
  normalizeLayouts,
  type DashboardLayouts,
} from '@/lib/dashboardLayout';

interface UserDashboardLayoutRow {
  user_id: string;
  layout: unknown;
  version: number;
  updated_at: string;
}

export function useDashboardLayout() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['user_dashboard_layout', userId],
    queryFn: async (): Promise<DashboardLayouts> => {
      if (!userId) return DEFAULT_LAYOUTS;
      const { data, error } = await supabase
        .from('user_dashboard_layouts' as never)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[useDashboardLayout] erro ao buscar layout:', error);
        return DEFAULT_LAYOUTS;
      }
      if (!data) return DEFAULT_LAYOUTS;
      return normalizeLayouts((data as UserDashboardLayoutRow).layout);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const persisted = query.data ?? DEFAULT_LAYOUTS;

  // Estado local "em edição" — só é persistido quando o usuário clica Salvar.
  const [draft, setDraft] = useState<DashboardLayouts | null>(null);

  useEffect(() => {
    // Descarta o draft quando o layout persistido muda (ex.: reset).
    setDraft(null);
  }, [persisted]);

  const layouts = draft ?? persisted;

  const saveMutation = useMutation({
    mutationFn: async (next: DashboardLayouts) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const { error } = await supabase
        .from('user_dashboard_layouts' as never)
        .upsert(
          { user_id: userId, layout: next as unknown as object },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['user_dashboard_layout', userId], next);
      setDraft(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const { error } = await supabase
        .from('user_dashboard_layouts' as never)
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(['user_dashboard_layout', userId], DEFAULT_LAYOUTS);
      setDraft(null);
    },
  });

  const updateDraft = useCallback((next: DashboardLayouts) => {
    setDraft(next);
  }, []);

  const cancelDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const hasDraft = draft !== null;

  return useMemo(
    () => ({
      layouts,
      isLoading: query.isLoading,
      hasDraft,
      updateDraft,
      cancelDraft,
      save: (next: DashboardLayouts) => saveMutation.mutateAsync(next),
      reset: () => resetMutation.mutateAsync(),
      isSaving: saveMutation.isPending,
      isResetting: resetMutation.isPending,
    }),
    [
      layouts,
      query.isLoading,
      hasDraft,
      updateDraft,
      cancelDraft,
      saveMutation,
      resetMutation,
    ]
  );
}
