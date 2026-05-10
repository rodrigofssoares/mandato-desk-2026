import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

// ─── Tipos ──────────────────────────────────────────────────────────────────

/**
 * Visão segura de uma conta Z-API — sem tokens em claro expostos à UI.
 * instance_token e client_token nunca chegam ao frontend: são omitidos
 * intencionalmente na seleção de colunas do useZapiAccounts.
 */
export type ZapiAccount = Omit<Tables<'zapi_accounts'>, 'instance_token' | 'client_token' | 'webhook_secret'> & {
  /** Primeiros 8 chars do instance_id para exibição — resto ofuscado. */
  instance_id_partial: string;
};

export type ZapiAccountRow = Tables<'zapi_accounts'>;

export interface CreateZapiAccountInput {
  name: string;
  instance_id: string;
  /** Texto puro — TEMPORÁRIO. Criptografia AES-256-GCM via EF zapi-encrypt em sessão futura. */
  instance_token: string;
  /** Texto puro — TEMPORÁRIO. */
  client_token: string;
  /** Senha extra do painel (texto puro — TEMPORÁRIO, bcrypt hash via EF em sessão futura). */
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
}

export interface ResetPanelPasswordInput {
  account_id: string;
  /** Nova senha (texto puro — TEMPORÁRIO, bcrypt hash via EF em sessão futura). */
  new_password: string;
}

// ─── Key Factory ────────────────────────────────────────────────────────────

export const zapiAccountKeys = {
  all: ['zapi-accounts'] as const,
  list: () => [...zapiAccountKeys.all] as const,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Colunas seguras: tokens e webhook_secret excluídos da query. */
const SAFE_COLUMNS = 'id, name, status, instance_id, created_at, updated_at, created_by' as const;

function toSafeAccount(row: Pick<ZapiAccountRow, 'id' | 'name' | 'status' | 'instance_id' | 'created_at' | 'updated_at' | 'created_by'>): ZapiAccount {
  return {
    ...row,
    instance_id_partial: row.instance_id.slice(0, 8),
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
 * Webhooks (admin only). RLS permite SELECT pra qualquer auth user, mas
 * o componente Webhooks gate-keepa por activeRole === 'admin'.
 *
 * Por que separamos do useZapiAccounts: o hook principal exclui
 * webhook_secret das colunas selecionadas pra evitar leak em telas que
 * não precisam dele (Conversas, Logs).
 */
export function useZapiWebhookConfigs(enabled: boolean) {
  return useQuery({
    queryKey: ['zapi-webhook-configs'],
    enabled,
    queryFn: async (): Promise<ZapiWebhookConfig[]> => {
      const { data, error } = await supabase
        .from('zapi_accounts')
        .select('id, name, webhook_secret')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ZapiWebhookConfig[];
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

      // Inserir senha extra, se fornecida
      if (input.panel_password && input.panel_password.trim()) {
        const { error: passErr } = await supabase
          .from('zapi_panel_passwords')
          .insert({
            account_id: data.id,
            password_hash: input.panel_password,
          });
        if (passErr) throw passErr;
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

// ─── useResetZapiPanelPassword ──────────────────────────────────────────────

/**
 * Redefine a senha extra do painel para uma conta.
 *
 * AVISO MVP: senha inserida em texto puro temporariamente.
 * Bcrypt hash server-side será aplicado via Edge Function em sessão futura (T03).
 */
export function useResetZapiPanelPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ResetPanelPasswordInput) => {
      // Tenta upsert — cria linha se ainda não existe para esta conta
      const { error } = await supabase
        .from('zapi_panel_passwords')
        .upsert(
          {
            account_id: input.account_id,
            password_hash: input.new_password,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zapiAccountKeys.all });
      toast.success('Senha do painel redefinida com sucesso');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error, 'Erro ao redefinir senha'));
    },
  });
}
