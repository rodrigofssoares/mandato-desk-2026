// useZapiBroadcasts.ts
// Hook para gestão de campanhas broadcast (T65/T66 / Fase 6 Onda A).
// Inclui listagem com Realtime, criação de rascunho e contagem de elegíveis.

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

export type ZapiBroadcast = Tables<'zapi_broadcasts'>;
export type ZapiBroadcastTarget = Tables<'zapi_broadcast_targets'>;

export const broadcastKeys = {
  all: ['zapi-broadcasts'] as const,
  byAccount: (accountId: string | null) => ['zapi-broadcasts', accountId] as const,
  targets: (broadcastId: string) => ['zapi-broadcast-targets', broadcastId] as const,
};

// ─── useZapiBroadcasts ────────────────────────────────────────────────────────

/**
 * Lista campanhas broadcast de uma conta.
 * Inclui Realtime para atualização de sent_count/status em tempo real.
 */
export function useZapiBroadcasts(accountId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: broadcastKeys.byAccount(accountId ?? null),
    enabled: !!accountId,
    queryFn: async (): Promise<ZapiBroadcast[]> => {
      const { data, error } = await supabase
        .from('zapi_broadcasts')
        .select('*')
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: atualiza sent_count e status sem reload
  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel(`zapi-broadcasts-${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zapi_broadcasts',
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: broadcastKeys.byAccount(accountId),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accountId, queryClient]);

  return query;
}

// ─── useZapiBroadcastTargets ──────────────────────────────────────────────────

/**
 * Lista targets de uma campanha específica (carregado ao abrir detalhes).
 */
export function useZapiBroadcastTargets(broadcastId: string | null | undefined) {
  return useQuery({
    queryKey: broadcastKeys.targets(broadcastId ?? ''),
    enabled: !!broadcastId,
    queryFn: async (): Promise<ZapiBroadcastTarget[]> => {
      const { data, error } = await supabase
        .from('zapi_broadcast_targets')
        .select('*')
        .eq('broadcast_id', broadcastId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── useCreateBroadcastDraft ──────────────────────────────────────────────────

export interface BroadcastDraftInput {
  account_id: string;
  title: string;
  body: string;
  tipo: 'mensagem' | 'enquete';
  poll_question?: string | null;
  poll_options?: string[] | null;
  segment_filters: {
    tags?: string[];
    bairro?: string;
    zona_eleitoral?: string;
  };
  ritmo_por_minuto: number;
  scheduled_at?: string | null;
}

/**
 * Cria um rascunho de broadcast (INSERT via service_role da EF será chamado depois).
 * O INSERT direto é bloqueado no client por RLS — usa-se a EF zapi-broadcast-create
 * que valida e insere via service_role.
 *
 * Estratégia: insere o rascunho via supabase.functions.invoke para que a EF
 * valide e crie o registro, depois dispara zapi-broadcast-create para resolver targets.
 *
 * Na prática: criamos o rascunho + chamamos zapi-broadcast-create em sequência.
 */
export function useCreateBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BroadcastDraftInput) => {
      // Passo 1: Cria o rascunho via uma RPC ou via inserção direta
      // Como INSERT está bloqueado por RLS, usamos a EF create que faz tudo.
      // Mas precisamos criar o rascunho antes de chamar create...
      // Solução: a EF broadcast-create aceita um broadcast_id existente.
      // Portanto criamos o rascunho via SQL (service_role não disponível no client).
      //
      // Alternativa: usar uma segunda EF "zapi-broadcast-draft" para criar o rascunho.
      // Por ora, contornamos usando uma RPC que insere e retorna o id.
      //
      // Simplificação pragmática: o INSERT do rascunho será feito via a EF create
      // passando o payload completo. Reorganizamos a EF para aceitar criação+resolução.
      const { data, error } = await supabase.functions.invoke('zapi-broadcast-create', {
        body: { create_draft: input },
      });

      if (error) {
        const ctx = (error as { context?: Response }).context;
        let detail = error.message ?? 'Erro ao criar campanha';
        if (ctx && typeof ctx.text === 'function') {
          try {
            const raw = await ctx.text();
            const parsed = JSON.parse(raw);
            if (parsed?.error) detail = parsed.error;
          } catch { /* sem body */ }
        }
        throw new Error(detail);
      }

      return data as { ok: boolean; broadcast_id: string; total_targets: number; status: string };
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({
        queryKey: broadcastKeys.byAccount(vars.account_id),
      });
      toast.success('Campanha iniciada com sucesso');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar campanha: ${err.message}`);
    },
  });
}

// ─── useCountEligibleContacts ─────────────────────────────────────────────────

export interface EligibleCountFilters {
  tags?: string[];
  bairro?: string;
  zona_eleitoral?: string;
}

/**
 * Conta contatos elegíveis (com optin_whatsapp=true) aplicando os filtros do segmento.
 * Usado no step 2 do composer para mostrar estimativa antes de confirmar.
 */
export async function countEligibleContacts(filters: EligibleCountFilters): Promise<{
  eligible: number;
  withoutOptin: number;
}> {
  // Query de todos os contatos que satisfazem os filtros
  let queryAll = supabase
    .from('contacts')
    .select('id, optin_whatsapp', { count: 'exact', head: false })
    .is('merged_into', null)
    .not('whatsapp', 'is', null);

  if (filters.bairro) {
    queryAll = queryAll.ilike('bairro', `%${filters.bairro}%`);
  }
  if (filters.zona_eleitoral) {
    queryAll = queryAll.ilike('zona_eleitoral', `%${filters.zona_eleitoral}%`);
  }

  const { data: allContacts, error } = await queryAll;
  if (error) throw error;

  let contacts = allContacts ?? [];

  // Filtro de tags (client-side para manter compatibilidade)
  if (filters.tags && filters.tags.length > 0) {
    const { data: taggedContacts } = await supabase
      .from('contact_tags')
      .select('contact_id')
      .in('tag_id', filters.tags);

    const taggedIds = new Set((taggedContacts ?? []).map((t) => t.contact_id));
    contacts = contacts.filter((c) => taggedIds.has(c.id));
  }

  const eligible = contacts.filter((c) => c.optin_whatsapp).length;
  const withoutOptin = contacts.length - eligible;

  return { eligible, withoutOptin };
}
