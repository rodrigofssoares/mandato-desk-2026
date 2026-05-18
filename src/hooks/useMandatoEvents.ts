// useMandatoEvents.ts
// Hook CRUD para eventos do mandato (T70 / Fase 6 Onda B — C20).
// Segue o padrão de useDemands.ts.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MandatoEvent {
  id: string;
  title: string;
  descricao: string | null;
  data_evento: string;
  local: string | null;
  account_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Total de RSVPs com status='confirmado' — calculado via JOIN */
  confirmados_count?: number;
}

export interface MandatoEventInsert {
  title: string;
  descricao?: string | null;
  data_evento: string;
  local?: string | null;
  account_id: string;
}

export interface MandatoEventUpdate extends Partial<MandatoEventInsert> {
  id: string;
}

export interface ContactEventRsvp {
  id: string;
  event_id: string;
  contact_id: string;
  status: 'pendente' | 'confirmado' | 'recusado';
  respondido_em: string | null;
  created_at: string;
}

export const mandatoEventsKeys = {
  all: ['mandato-events'] as const,
  byAccount: (accountId: string | null) => ['mandato-events', accountId] as const,
  rsvps: (contactId: string | null) => ['contact-event-rsvps', contactId] as const,
};

// ─── useMandatoEvents ─────────────────────────────────────────────────────────

/**
 * Lista eventos do mandato de uma conta, ordenados por data_evento ASC.
 * Inclui contagem de confirmados via join.
 */
export function useMandatoEvents(accountId: string | null | undefined) {
  return useQuery({
    queryKey: mandatoEventsKeys.byAccount(accountId ?? null),
    enabled: !!accountId,
    queryFn: async (): Promise<MandatoEvent[]> => {
      const { data, error } = await supabase
        .from('mandato_events')
        .select(`
          *,
          contact_event_rsvps!event_id(status)
        `)
        .eq('account_id', accountId!)
        .order('data_evento', { ascending: true });

      if (error) throw error;

      return ((data ?? []) as unknown[]).map((row) => {
        const r = row as MandatoEvent & { contact_event_rsvps?: Array<{ status: string }> };
        const confirmados_count = (r.contact_event_rsvps ?? []).filter(
          (rsvp) => rsvp.status === 'confirmado',
        ).length;
        // Remove campo de join antes de retornar
        const stripped = { ...r, confirmados_count } as MandatoEvent & { confirmados_count: number; contact_event_rsvps?: unknown };
        delete stripped.contact_event_rsvps;
        return stripped as MandatoEvent & { confirmados_count: number };
      });
    },
  });
}

// ─── useCreateMandatoEvent ────────────────────────────────────────────────────

export function useCreateMandatoEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: MandatoEventInsert): Promise<MandatoEvent> => {
      const { data, error } = await supabase
        .from('mandato_events')
        .insert({ ...input, created_by: user?.id })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as MandatoEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: mandatoEventsKeys.byAccount(data.account_id),
      });
      toast.success('Evento criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar evento: ${error.message}`);
    },
  });
}

// ─── useUpdateMandatoEvent ────────────────────────────────────────────────────

export function useUpdateMandatoEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MandatoEventUpdate): Promise<MandatoEvent> => {
      const { id, ...updateData } = input;
      const { data, error } = await supabase
        .from('mandato_events')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as MandatoEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: mandatoEventsKeys.byAccount(data.account_id),
      });
      toast.success('Evento atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar evento: ${error.message}`);
    },
  });
}

// ─── useDeleteMandatoEvent ────────────────────────────────────────────────────

export function useDeleteMandatoEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, accountId: _accountId }: { id: string; accountId: string }): Promise<void> => {
      const { error } = await supabase
        .from('mandato_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: mandatoEventsKeys.byAccount(vars.accountId),
      });
      toast.success('Evento excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir evento: ${error.message}`);
    },
  });
}

// ─── useContactEventRsvps ─────────────────────────────────────────────────────

/**
 * Lista RSVPs de um contato específico.
 * Usado no ContactPanel para mostrar status de convite por evento.
 */
export function useContactEventRsvps(contactId: string | null | undefined) {
  return useQuery({
    queryKey: mandatoEventsKeys.rsvps(contactId ?? null),
    enabled: !!contactId,
    queryFn: async (): Promise<ContactEventRsvp[]> => {
      const { data, error } = await supabase
        .from('contact_event_rsvps')
        .select('*')
        .eq('contact_id', contactId!);

      if (error) throw error;
      return (data ?? []) as unknown as ContactEventRsvp[];
    },
  });
}

// ─── useUpsertRsvp ────────────────────────────────────────────────────────────

export function useUpsertRsvp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      event_id,
      contact_id,
      status,
    }: {
      event_id: string;
      contact_id: string;
      status: 'pendente' | 'confirmado' | 'recusado';
    }): Promise<ContactEventRsvp> => {
      const respondido_em =
        status !== 'pendente' ? new Date().toISOString() : null;

      const { data, error } = await supabase
        .from('contact_event_rsvps')
        .upsert(
          { event_id, contact_id, status, respondido_em },
          { onConflict: 'event_id,contact_id' },
        )
        .select()
        .single();

      if (error) throw error;
      return data as unknown as ContactEventRsvp;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: mandatoEventsKeys.rsvps(vars.contact_id),
      });
      // Invalida também a lista de eventos (contagem de confirmados)
      queryClient.invalidateQueries({ queryKey: mandatoEventsKeys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar RSVP: ${error.message}`);
    },
  });
}
