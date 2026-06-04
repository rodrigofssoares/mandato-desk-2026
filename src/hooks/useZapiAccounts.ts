import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { RecursosConfig } from '@/lib/featureFlags';

// URL do Supabase para chamadas diretas às Edge Functions
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// ─── Tipos ──────────────────────────────────────────────────────────────────

/**
 * Visão segura de uma conta Z-API — sem tokens em claro expostos à UI.
 * instance_token e client_token nunca chegam ao frontend: são omitidos
 * intencionalmente na seleção de colunas do useZapiAccounts.
 */
export type ZapiAccount = Omit<Tables<'zapi_accounts'>, 'instance_token' | 'client_token' | 'webhook_secret'> & {
  /** Primeiros 8 chars do instance_id para exibição — resto ofuscado. */
  instance_id_partial: string;
  /** Feature flags por conta (C40). Null/undefined quando a conta não tem a coluna ainda. */
  recursos_config: RecursosConfig;
};

export type ZapiAccountRow = Tables<'zapi_accounts'>;

export interface CreateZapiAccountInput {
  name: string;
  instance_id: string;
  /** Texto puro — TEMPORÁRIO. Criptografia AES-256-GCM via EF zapi-encrypt em sessão futura. */
  instance_token: string;
  /** Texto puro — TEMPORÁRIO. */
  client_token: string;
  /** Senha extra do painel. Enviada via EF zapi-set-panel-password para hash PBKDF2 server-side. */
  panel_password?: string;
}

export interface UpdateZapiAccountInput {
  id: string;
  name?: string;
  instance_id?: string;
  /** Opcional — só atualiza se fornecido. Texto puro — TEMPORÁRIO. */
  instance_token?: string;
  /** Opcional — só atualiza se fornecido. Texto puro — TEMPORÁRIO. */
  client_token?: string;
  /** Feature flags da conta (C40). Substituição completa do objeto JSONB. */
  recursos_config?: RecursosConfig;
  /** T51/C27: horário de atendimento por dia da semana. null = desabilitar. */
  horario_atendimento?: Record<string, unknown> | null;
}

export interface ResetPanelPasswordInput {
  account_id: string;
  /** Nova senha em texto puro — hash PBKDF2-SHA256 gerado server-side pela EF zapi-set-panel-password. */
  new_password: string;
}

// ─── Key Factory ────────────────────────────────────────────────────────────

export const zapiAccountKeys = {
  all: ['zapi-accounts'] as const,
  list: () => [...zapiAccountKeys.all] as const,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Colunas seguras: tokens e webhook_secret excluídos da query. */
const SAFE_COLUMNS = 'id, name, status, instance_id, created_at, updated_at, created_by, recursos_config, horario_atendimento' as const;

function toSafeAccount(
  row: Pick<ZapiAccountRow, 'id' | 'name' | 'status' | 'instance_id' | 'created_at' | 'updated_at' | 'created_by' | 'recursos_config' | 'horario_atendimento'>,
): ZapiAccount {
  const cfg = row.recursos_config;
  const recursos_config: RecursosConfig =
    cfg && typeof cfg === 'object' && !Array.isArray(cfg)
      ? (cfg as RecursosConfig)
      : {};

  return {
    ...row,
    instance_id_partial: row.instance_id.slice(0, 8),
    recursos_config,
  };
}

/**
 * Normaliza mensagens de erro do Supabase pra exibir ao usuário sem vazar
 * detalhes internos do schema (nome de tabela, policies, SQL state).
 *
 * Why: Security audit Fase 2 (F1, F4) — mensagem RLS bruta tipo
 * "new row violates row-level security policy for table zapi_accounts" expõe
 * o nome da tabela e confirma a existência da restrição. Substituímos por
 * texto neutro pra usuário não-admin, mantendo a mensagem original em
 * console.error pra debug do dev.
 */
function sanitizeError(error: Error, fallback: string): string {
  const msg = error.message ?? '';
  if (/row-level security|permission denied|new row violates/i.test(msg)) {
    return 'Você não tem permissão para esta operação. Contate o administrador.';
  }
  return `${fallback}: ${msg}`;
}

// ─── useZapiAccounts ────────────────────────────────────────────────────────

/**
 * Lista todas as contas Z-API.
 * Tokens nunca chegam ao frontend — coluna instance_token/client_token excluída da query.
 */
export function useZapiAccounts() {
  return useQuery({
    queryKey: zapiAccountKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zapi_accounts')
        .select(SAFE_COLUMNS)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []).map(toSafeAccount);
    },
  });
}

// ─── useZapiWebhookConfigs ──────────────────────────────────────────────────

export interface ZapiWebhookConfig {
  id: string;
  name: string;
  webhook_secret: string;
}

/**
 * Retorna { id, name, webhook_secret } por conta — usado APENAS na aba
 * Webhooks (admin only). O componente Webhooks gate-keepa por
 * activeRole === 'admin'.
 *
 * IMPORTANTE: a coluna `webhook_secret` teve SELECT revogado de `authenticated`
 * pela migration 046 (hardening pós-pentest). Ler a coluna direto via PostgREST
 * falha com "permission denied". O canal oficial é a RPC `zapi_get_webhook_secret`,
 * SECURITY DEFINER, que valida `has_role(uid,'admin')` server-side.
 *
 * Por que não vem do useZapiAccounts: o hook principal já exclui webhook_secret
 * das colunas pra evitar leak em telas que não precisam dele (Conversas, Logs).
 */
export function useZapiWebhookConfigs(enabled: boolean) {
  return useQuery({
    queryKey: ['zapi-webhook-configs'],
    enabled,
    queryFn: async (): Promise<ZapiWebhookConfig[]> => {
      const { data: accounts, error } = await supabase
        .from('zapi_accounts')
        .select('id, name')
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Busca o secret de cada conta via RPC (canal autorizado, admin-only).
      // O nº de contas Z-API é pequeno (1-3), então o N+1 aqui é irrelevante.
      return Promise.all(
        (accounts ?? []).map(async (acc) => {
          const { data: secret, error: secretErr } = await supabase.rpc(
            'zapi_get_webhook_secret',
            { _account_id: acc.id },
          );
          if (secretErr) {
            console.error('useZapiWebhookConfigs: falha ao obter webhook_secret', acc.id, secretErr.message);
            throw secretErr;
          }
          return { id: acc.id, name: acc.name, webhook_secret: secret ?? '' };
        }),
      );
    },
  });
}

// ─── useCreateZapiAccount ───────────────────────────────────────────────────

/**
 * Cria uma nova conta Z-API.
 *
 * AVISO MVP: tokens inseridos em texto puro temporariamente.
 * Criptografia AES-256-GCM será aplicada via Edge Function `zapi-encrypt`
 * em sessão futura (T01/T02).
 *
 * Se panel_password for fornecida, chama a EF zapi-set-panel-password para
 * gerar o hash PBKDF2-SHA256 server-side. Nunca grava a senha em texto puro.
 */
export function useCreateZapiAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateZapiAccountInput) => {
      const payload: TablesInsert<'zapi_accounts'> = {
        name: input.name,
        instance_id: input.instance_id,
        instance_token: input.instance_token,
        client_token: input.client_token,
      };

      const { data, error } = await supabase
        .from('zapi_accounts')
        .insert(payload)
        .select(SAFE_COLUMNS)
        .single();

      if (error) throw error;

      // F2 Security-Fix: senha via EF (hash PBKDF2 server-side), nunca texto puro direto no banco.
      if (input.panel_password && input.panel_password.trim()) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/zapi-set-panel-password`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              account_id: data.id,
              new_password: input.panel_password,
            }),
          },
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error((errData as { error?: string }).error ?? 'Erro ao definir senha do painel');
        }
      }

      return toSafeAccount(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zapiAccountKeys.all });
      toast.success('Conta Z-API criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error, 'Erro ao criar conta'));
    },
  });
}

// ─── useUpdateZapiAccount ───────────────────────────────────────────────────

/**
 * Edita uma conta Z-API existente.
 * Tokens são opcionais — só atualizados se fornecidos.
 */
export function useUpdateZapiAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateZapiAccountInput) => {
      const payload: TablesUpdate<'zapi_accounts'> = {
        updated_at: new Date().toISOString(),
      };
      if (input.name !== undefined) payload.name = input.name;
      if (input.instance_id !== undefined) payload.instance_id = input.instance_id;
      if (input.instance_token !== undefined) payload.instance_token = input.instance_token;
      if (input.client_token !== undefined) payload.client_token = input.client_token;
      if (input.recursos_config !== undefined) payload.recursos_config = input.recursos_config;
      if (input.horario_atendimento !== undefined) payload.horario_atendimento = input.horario_atendimento as import('@/integrations/supabase/types').Json;

      const { data, error } = await supabase
        .from('zapi_accounts')
        .update(payload)
        .eq('id', input.id)
        .select(SAFE_COLUMNS)
        .single();

      if (error) throw error;
      return toSafeAccount(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zapiAccountKeys.all });
      toast.success('Conta atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error, 'Erro ao atualizar conta'));
    },
  });
}

// ─── useDeleteZapiAccount ───────────────────────────────────────────────────

/**
 * Exclui uma conta Z-API.
 * Logs e mensagens permanecem com account_id preservado (sem cascade).
 */
export function useDeleteZapiAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from('zapi_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zapiAccountKeys.all });
      toast.success('Conta excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error, 'Erro ao excluir conta'));
    },
  });
}

// ─── useZapiPanelPasswordStatus ─────────────────────────────────────────────

/** Chave de query para status de senha por conta. */
export const zapiPanelPasswordStatusKeys = {
  all: ['zapi-panel-password-status'] as const,
  byAccount: (accountId: string) => [...zapiPanelPasswordStatusKeys.all, accountId] as const,
};

/**
 * Verifica se uma conta Z-API tem senha de painel definida.
 * Lê apenas a existência do registro em zapi_panel_passwords (admin-only via RLS).
 * Não-admin recebe null (sem acesso).
 */
export function useZapiPanelPasswordStatus(accountId: string | null) {
  return useQuery({
    queryKey: accountId ? zapiPanelPasswordStatusKeys.byAccount(accountId) : [],
    enabled: !!accountId,
    queryFn: async (): Promise<boolean> => {
      if (!accountId) return false;
      const { data, error } = await supabase
        .from('zapi_panel_passwords')
        .select('account_id')
        .eq('account_id', accountId)
        .maybeSingle();

      if (error) {
        // RLS bloqueia não-admin — retorna false silenciosamente
        if (error.code === 'PGRST301' || /permission denied/i.test(error.message)) {
          return false;
        }
        throw error;
      }
      return data !== null;
    },
  });
}

/**
 * Retorna o status de senha para todas as contas de uma lista.
 * Lê todos os registros em zapi_panel_passwords (admin-only via RLS).
 */
export function useZapiAllPanelPasswordStatuses() {
  return useQuery({
    queryKey: [...zapiPanelPasswordStatusKeys.all, 'all-accounts'],
    queryFn: async (): Promise<Record<string, boolean>> => {
      const { data, error } = await supabase
        .from('zapi_panel_passwords')
        .select('account_id');

      if (error) {
        // Não-admin não tem SELECT — retorna vazio silenciosamente
        if (error.code === 'PGRST301' || /permission denied/i.test(error.message)) {
          return {};
        }
        throw error;
      }

      const map: Record<string, boolean> = {};
      for (const row of data ?? []) {
        map[row.account_id] = true;
      }
      return map;
    },
  });
}

// ─── useResetZapiPanelPassword ──────────────────────────────────────────────

/**
 * Define ou altera a senha do painel de conversas de uma conta Z-API.
 * Chama a Edge Function `zapi-set-panel-password` que gera hash PBKDF2-SHA256
 * server-side. Somente admin pode chamar esta função (enforced pela EF).
 *
 * EM078: substitui o upsert de texto puro anterior.
 */
export function useResetZapiPanelPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ResetPanelPasswordInput) => {
      // Obtém o token JWT do usuário para autenticar a chamada à EF
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/zapi-set-panel-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            account_id: input.account_id,
            new_password: input.new_password,
          }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? 'Erro ao definir senha');
      }
    },
    onSuccess: (_data, input) => {
      // Invalida status de senha desta conta para refletir o novo estado
      queryClient.invalidateQueries({
        queryKey: zapiPanelPasswordStatusKeys.byAccount(input.account_id),
      });
      queryClient.invalidateQueries({
        queryKey: [...zapiPanelPasswordStatusKeys.all, 'all-accounts'],
      });
      toast.success('Senha do painel definida com sucesso');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error, 'Erro ao definir senha'));
    },
  });
}

// ─── useRemoveZapiPanelPassword ──────────────────────────────────────────────

/**
 * Remove a senha do painel de uma conta Z-API via EF zapi-set-panel-password.
 * Chama a EF com new_password: null — server-side deleta o hash E invalida todos
 * os grants ativos da conta (F3 Security-Fix: estagiário perde acesso imediatamente).
 * Apenas admin pode chamar (enforced pela EF).
 */
export function useRemoveZapiPanelPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      // F3 Security-Fix: usar EF para remover senha + invalidar grants ativos.
      // Delete direto do client deixaria grants válidos por até 8h.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/zapi-set-panel-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            account_id: accountId,
            new_password: null,
          }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? 'Erro ao remover senha');
      }
    },
    onSuccess: (_data, accountId) => {
      queryClient.invalidateQueries({
        queryKey: zapiPanelPasswordStatusKeys.byAccount(accountId),
      });
      queryClient.invalidateQueries({
        queryKey: [...zapiPanelPasswordStatusKeys.all, 'all-accounts'],
      });
      toast.success('Senha removida — conta acessível sem senha');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error, 'Erro ao remover senha'));
    },
  });
}
