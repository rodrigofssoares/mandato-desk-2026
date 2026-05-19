// useRelationshipRules.ts
// Hook CRUD para réguas de relacionamento automático (T74 / Fase 6 Onda B — C22).
// Segue o padrão de useDemands.ts.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface RelationshipRule {
  id: string;
  account_id: string;
  nome: string;
  board_stage_id: string | null;
  dias_sem_resposta: number;
  mensagem_template: string;
  ativo: boolean;
  created_by: string;
  created_at: string;
}

export interface RelationshipRuleInsert {
  account_id: string;
  nome: string;
  board_stage_id?: string | null;
  dias_sem_resposta: number;
  mensagem_template: string;
  ativo?: boolean;
}

export interface RelationshipRuleUpdate extends Partial<RelationshipRuleInsert> {
  id: string;
}

export const relationshipRulesKeys = {
  all: ['relationship-rules'] as const,
  byAccount: (accountId: string | null) => ['relationship-rules', accountId] as const,
};

// ─── useRelationshipRules ─────────────────────────────────────────────────────

export function useRelationshipRules(accountId: string | null | undefined) {
  return useQuery({
    queryKey: relationshipRulesKeys.byAccount(accountId ?? null),
    enabled: !!accountId,
    queryFn: async (): Promise<RelationshipRule[]> => {
      const { data, error } = await supabase
        .from('zapi_relationship_rules')
        .select('*')
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as RelationshipRule[];
    },
  });
}

// ─── useCreateRelationshipRule ────────────────────────────────────────────────

export function useCreateRelationshipRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: RelationshipRuleInsert): Promise<RelationshipRule> => {
      const { data, error } = await supabase
        .from('zapi_relationship_rules')
        .insert({ ...input, created_by: user?.id })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RelationshipRule;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: relationshipRulesKeys.byAccount(data.account_id),
      });
      toast.success('Régua criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar régua: ${error.message}`);
    },
  });
}

// ─── useUpdateRelationshipRule ────────────────────────────────────────────────

export function useUpdateRelationshipRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RelationshipRuleUpdate): Promise<RelationshipRule> => {
      const { id, ...updateData } = input;
      const { data, error } = await supabase
        .from('zapi_relationship_rules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RelationshipRule;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: relationshipRulesKeys.byAccount(data.account_id),
      });
      toast.success('Régua atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar régua: ${error.message}`);
    },
  });
}

// ─── useDeleteRelationshipRule ────────────────────────────────────────────────

export function useDeleteRelationshipRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, accountId: _accountId }: { id: string; accountId: string }): Promise<void> => {
      const { error } = await supabase
        .from('zapi_relationship_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: relationshipRulesKeys.byAccount(vars.accountId),
      });
      toast.success('Régua excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir régua: ${error.message}`);
    },
  });
}
