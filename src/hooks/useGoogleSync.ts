import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

// ─── Key Factory ────────────────────────────────────────────────────────────

export const googleSyncKeys = {
  all: ['google-sync'] as const,
  status: () => [...googleSyncKeys.all, 'status'] as const,
  settings: () => [...googleSyncKeys.all, 'settings'] as const,
  counts: () => [...googleSyncKeys.all, 'counts'] as const,
  logs: (limit?: number) => [...googleSyncKeys.all, 'logs', limit] as const,
  errors: () => [...googleSyncKeys.all, 'errors'] as const,
};

// ─── Types ──────────────────────────────────────────────────────────────────

// FIX P-HIGH-1: interface sem access_token/refresh_token — tokens nunca chegam ao frontend
export interface GoogleTokenStatus {
  id: string;
  user_id: string;
  google_email: string | null;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface GoogleSyncSettings {
  id: string;
  user_id: string;
  sync_enabled: boolean;
  bidirectional_sync: boolean;
  sync_tags: boolean;
  keep_on_google_delete: boolean;
  last_full_sync: string | null;
  last_sync_token: string | null;
}

export interface SyncStatusCounts {
  synced: number;
  error: number;
  pending: number;
}

export interface GoogleSyncLog {
  id: string;
  user_id: string;
  contact_id: string | null;
  direction: string;
  operation: string;
  status: string;
  error_message: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  contacts: { nome: string } | null;
}

export interface ContactSyncError {
  id: string;
  contact_id: string;
  user_id: string;
  google_resource_name: string | null;
  sync_status: string;
  last_error: string | null;
  last_synced_at: string | null;
  contacts: { nome: string; id: string } | null;
}

// ─── useStartGoogleAuth ─────────────────────────────────────────────────────

/**
 * Inicia o fluxo OAuth do Google via POST autenticado.
 * A Edge Function valida o JWT e retorna a URL de autorização do Google.
 * O frontend abre essa URL num popup — evita envio de user_id como query param.
 */
export async function startGoogleAuth(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('google-auth/start', {
    method: 'POST',
    body: {},
  });
  if (error) throw error;
  const url = (data as { authorization_url?: string })?.authorization_url;
  if (!url) throw new Error('URL de autorização não retornada pelo servidor');
  return url;
}

// ─── useGoogleStatus ────────────────────────────────────────────────────────

export function useGoogleStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: googleSyncKeys.status(),
    enabled: !!user?.id,
    queryFn: async () => {
      // FIX P-HIGH-1: selecionar apenas colunas seguras — sem access_token/refresh_token
      const { data, error } = await supabase
        .from('google_oauth_tokens_safe')
        .select('id, user_id, google_email, is_active, expires_at, created_at, updated_at')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as GoogleTokenStatus | null;
    },
    select: (data) => ({
      token: data,
      isConnected: !!data && data.is_active,
      isExpired: !!data && !data.is_active,
      isLoading: false,
      googleEmail: data?.google_email ?? null,
    }),
  });
}

// ─── useGoogleSettings ──────────────────────────────────────────────────────

export function useGoogleSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: googleSyncKeys.settings(),
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('google_sync_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as GoogleSyncSettings | null;
    },
  });
}

// ─── useUpdateGoogleSettings ─────────────────────────────────────────────────

// FIX P-MED-1: whitelist de keys permitidas em runtime — impede mass assignment via XSS
const ALLOWED_SETTINGS_KEYS = ['sync_enabled', 'keep_on_google_delete', 'last_full_sync'] as const;
type AllowedSettingsKey = (typeof ALLOWED_SETTINGS_KEYS)[number];

export function useUpdateGoogleSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Pick<GoogleSyncSettings, AllowedSettingsKey>>) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Filtra keys em runtime — defesa contra injeção de campos fora da whitelist
      const filtered = Object.fromEntries(
        Object.entries(updates).filter(([k]) => (ALLOWED_SETTINGS_KEYS as readonly string[]).includes(k))
      ) as Pick<GoogleSyncSettings, AllowedSettingsKey>;

      const { error } = await supabase
        .from('google_sync_settings')
        .update({ ...filtered, updated_at: new Date().toISOString() } as never)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: googleSyncKeys.settings() });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar configurações: ${error.message}`);
    },
  });
}

// ─── useDisconnectGoogle ─────────────────────────────────────────────────────

export function useDisconnectGoogle() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Desabilita sync_enabled primeiro
      await supabase
        .from('google_sync_settings')
        .update({ sync_enabled: false, updated_at: new Date().toISOString() } as never)
        .eq('user_id', user.id);

      // Remove o token OAuth
      const { error } = await supabase
        .from('google_oauth_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: googleSyncKeys.all });
      toast.success('Conta Google desconectada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desconectar: ${error.message}`);
    },
  });
}

// ─── useSyncStatusCounts ────────────────────────────────────────────────────

export function useSyncStatusCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: googleSyncKeys.counts(),
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_sync')
        .select('sync_status')
        .eq('user_id', user!.id);

      if (error) throw error;

      const counts: SyncStatusCounts = { synced: 0, error: 0, pending: 0 };
      (data ?? []).forEach((row) => {
        if (row.sync_status === 'synced') counts.synced++;
        else if (row.sync_status === 'error') counts.error++;
        else if (row.sync_status === 'pending') counts.pending++;
      });

      return counts;
    },
  });
}

// ─── useGoogleSyncLogs ──────────────────────────────────────────────────────

export function useGoogleSyncLogs(limit = 50) {
  const { user } = useAuth();

  return useQuery({
    queryKey: googleSyncKeys.logs(limit),
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('google_sync_logs')
        .select('*, contacts(nome)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as GoogleSyncLog[];
    },
  });
}

// ─── useContactSyncErrors ────────────────────────────────────────────────────

export function useContactSyncErrors() {
  const { user } = useAuth();

  return useQuery({
    queryKey: googleSyncKeys.errors(),
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_sync')
        .select('*, contacts(id, nome)')
        .eq('user_id', user!.id)
        .eq('sync_status', 'error')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as ContactSyncError[];
    },
  });
}
