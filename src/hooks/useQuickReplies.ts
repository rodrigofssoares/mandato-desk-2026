// Hook: useQuickReplies
//
// CRUD completo de respostas rápidas (zapi_quick_replies).
// Extrai variáveis automaticamente do corpo (regex {{(\w+)}}).
//
// - listQuery: SELECT WHERE account_id ORDER BY categoria, titulo
// - createMutation: INSERT com variaveis[] calculado do corpo
// - updateMutation: UPDATE com variaveis[] recalculado
// - deleteMutation: DELETE por id
//
// Referência: RAQ-MAND-EM073 — T46

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface QuickReply {
  id: string;
  account_id: string;
  titulo: string;
  corpo: string;
  categoria: string | null;
  variaveis: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuickReplyInsert {
  account_id: string;
  titulo: string;
  corpo: string;
  categoria?: string | null;
}

export interface QuickReplyUpdate {
  id: string;
  titulo?: string;
  corpo?: string;
  categoria?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extrai nomes de variáveis únicos do corpo da resposta.
 * Ex: "Olá {{nome}}, bem-vindo a {{bairro}}" → ["nome", "bairro"]
 */
export function extractVariables(corpo: string): string[] {
  const matches = [...corpo.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  // Deduplica mantendo a ordem de aparição
  return [...new Set(matches)];
}

// ─── Key factory ─────────────────────────────────────────────────────────────

export const quickReplyKeys = {
  byAccount: (accountId: string | null) => ['quick-replies', accountId] as const,
};

// ─── useQuickReplies ──────────────────────────────────────────────────────────

/**
 * CRUD de respostas rápidas para uma conta Z-API.
 * @param accountId - ID da conta (null = hook desabilitado).
 */
export function useQuickReplies(accountId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // ── Listagem ────────────────────────────────────────────────────────────────
  const listQuery = useQuery<QuickReply[]>({
    queryKey: quickReplyKeys.byAccount(accountId ?? null),
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zapi_quick_replies')
        .select('*')
        .eq('account_id', accountId!)
        .order('categoria', { ascending: true, nullsFirst: false })
        .order('titulo', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => ({
        ...row,
        variaveis: Array.isArray(row.variaveis) ? (row.variaveis as string[]) : null,
      })) as QuickReply[];
    },
  });

  // ── Criação ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (input: QuickReplyInsert) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const vars = extractVariables(input.corpo);
      const { data, error } = await supabase
        .from('zapi_quick_replies')
        .insert({
          account_id: input.account_id,
          titulo: input.titulo,
          corpo: input.corpo,
          categoria: input.categoria ?? null,
          variaveis: vars.length > 0 ? vars : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (accountId) queryClient.invalidateQueries({ queryKey: quickReplyKeys.byAccount(accountId) });
      toast.success('Resposta rápida criada');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar resposta rápida: ${err.message}`);
    },
  });

  // ── Atualização ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async (input: QuickReplyUpdate) => {
      const { id, ...rest } = input;

      const updateData: Record<string, unknown> = { ...rest };
      if (rest.corpo !== undefined) {
        const vars = extractVariables(rest.corpo);
        updateData.variaveis = vars.length > 0 ? vars : null;
      }

      const { data, error } = await supabase
        .from('zapi_quick_replies')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (accountId) queryClient.invalidateQueries({ queryKey: quickReplyKeys.byAccount(accountId) });
      toast.success('Resposta rápida atualizada');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar resposta rápida: ${err.message}`);
    },
  });

  // ── Exclusão ─────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('zapi_quick_replies')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      if (accountId) queryClient.invalidateQueries({ queryKey: quickReplyKeys.byAccount(accountId) });
      toast.success('Resposta rápida excluída');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir resposta rápida: ${err.message}`);
    },
  });

  return { listQuery, createMutation, updateMutation, deleteMutation };
}
