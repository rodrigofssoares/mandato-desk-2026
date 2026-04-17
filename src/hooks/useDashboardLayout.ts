import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  type ChartViewType,
  type DashboardConfig,
  type DashboardLayouts,
  type DashboardWidgetId,
  type WidgetPref,
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
    queryFn: async (): Promise<DashboardConfig> => {
      if (!userId) return DEFAULT_CONFIG;
      const { data, error } = await supabase
        .from('user_dashboard_layouts' as never)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[useDashboardLayout] erro ao buscar layout:', error);
        return DEFAULT_CONFIG;
      }
      if (!data) return DEFAULT_CONFIG;
      return normalizeConfig((data as UserDashboardLayoutRow).layout);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const persisted = query.data ?? DEFAULT_CONFIG;

  // Draft só é persistido quando o usuário clica Salvar.
  const [draft, setDraft] = useState<DashboardConfig | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [persisted]);

  const config = draft ?? persisted;

  const saveMutation = useMutation({
    mutationFn: async (next: DashboardConfig) => {
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
      queryClient.setQueryData(['user_dashboard_layout', userId], DEFAULT_CONFIG);
      setDraft(null);
    },
  });

  const updateLayouts = useCallback(
    (nextLayouts: DashboardLayouts) => {
      setDraft({ ...config, layouts: nextLayouts });
    },
    [config]
  );

  const updateWidgetPref = useCallback(
    (widgetId: DashboardWidgetId, patch: Partial<WidgetPref>) => {
      const current = config.widgetPrefs[widgetId] ?? {};
      const merged: WidgetPref = { ...current, ...patch };
      const cleaned: WidgetPref = {};
      if (merged.hidden) cleaned.hidden = true;
      if (merged.chartType) cleaned.chartType = merged.chartType;

      const nextPrefs = { ...config.widgetPrefs };
      if (Object.keys(cleaned).length === 0) {
        delete nextPrefs[widgetId];
      } else {
        nextPrefs[widgetId] = cleaned;
      }
      setDraft({ ...config, widgetPrefs: nextPrefs });
    },
    [config]
  );

  const setChartType = useCallback(
    async (widgetId: DashboardWidgetId, chartType: ChartViewType) => {
      const current = config.widgetPrefs[widgetId] ?? {};
      const nextPrefs = {
        ...config.widgetPrefs,
        [widgetId]: { ...current, chartType },
      };
      const next: DashboardConfig = { ...config, widgetPrefs: nextPrefs };
      await saveMutation.mutateAsync(next);
    },
    [config, saveMutation]
  );

  const setHidden = useCallback(
    (widgetId: DashboardWidgetId, hidden: boolean) => {
      updateWidgetPref(widgetId, { hidden });
    },
    [updateWidgetPref]
  );

  const cancelDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const hasDraft = draft !== null;

  return useMemo(
    () => ({
      config,
      layouts: config.layouts,
      widgetPrefs: config.widgetPrefs,
      isLoading: query.isLoading,
      hasDraft,
      updateLayouts,
      updateWidgetPref,
      setHidden,
      setChartType,
      cancelDraft,
      save: (next?: DashboardConfig) =>
        saveMutation.mutateAsync(next ?? config),
      reset: () => resetMutation.mutateAsync(),
      isSaving: saveMutation.isPending,
      isResetting: resetMutation.isPending,
    }),
    [
      config,
      query.isLoading,
      hasDraft,
      updateLayouts,
      updateWidgetPref,
      setHidden,
      setChartType,
      cancelDraft,
      saveMutation,
      resetMutation,
    ]
  );
}
