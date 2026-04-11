import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';
import { startOfDay, endOfDay, addDays, endOfWeek } from 'date-fns';

// ============================================================================
// Tipos
// ============================================================================

export type TarefaTipo = 'LIGACAO' | 'REUNIAO' | 'VISITA' | 'WHATSAPP' | 'EMAIL' | 'TAREFA';

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TarefaTipo;
  data_agendada: string | null;
  concluida: boolean;
  concluida_em: string | null;
  responsavel_id: string | null;
  contact_id: string | null;
  leader_id: string | null;
  demand_id: string | null;
  board_item_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TarefaInsert {
  titulo: string;
  descricao?: string | null;
  tipo?: TarefaTipo;
  data_agendada?: string | null;
  responsavel_id?: string | null;
  contact_id?: string | null;
  leader_id?: string | null;
  demand_id?: string | null;
  board_item_id?: string | null;
}

export interface TarefaFilters {
  search?: string;
  tipos?: TarefaTipo[];
  periodo?: 'hoje' | 'amanha' | 'semana' | 'atrasadas' | 'todas';
  responsavel_id?: string;
  contact_id?: string;
  leader_id?: string;
  demand_id?: string;
  board_item_id?: string;
  concluida?: boolean;
  /** Range customizado em ISO (usado pela vista calendário). Aplicado junto com o filtro de período se ambos forem informados. */
  rangeStart?: string;
  rangeEnd?: string;
}

// ============================================================================
// Queries
// ============================================================================

export function useTarefas(filters: TarefaFilters = {}) {
  return useQuery<Tarefa[]>({
    queryKey: ['tarefas', filters],
    queryFn: async () => {
      let query = supabase.from('tarefas').select('*');

      if (filters.search) {
        query = query.ilike('titulo', `%${filters.search}%`);
      }
      if (filters.tipos && filters.tipos.length > 0) {
        query = query.in('tipo', filters.tipos);
      }
      if (filters.responsavel_id) {
        query = query.eq('responsavel_id', filters.responsavel_id);
      }
      if (filters.contact_id) {
        query = query.eq('contact_id', filters.contact_id);
      }
      if (filters.leader_id) {
        query = query.eq('leader_id', filters.leader_id);
      }
      if (filters.demand_id) {
        query = query.eq('demand_id', filters.demand_id);
      }
      if (filters.board_item_id) {
        query = query.eq('board_item_id', filters.board_item_id);
      }
      if (filters.concluida !== undefined) {
        query = query.eq('concluida', filters.concluida);
      }

      // Range customizado (calendário) — aplica gte/lte direto em data_agendada
      if (filters.rangeStart) {
        query = query.gte('data_agendada', filters.rangeStart);
      }
      if (filters.rangeEnd) {
        query = query.lte('data_agendada', filters.rangeEnd);
      }

      // Filtro por período
      if (filters.periodo && filters.periodo !== 'todas') {
        const now = new Date();
        if (filters.periodo === 'hoje') {
          query = query
            .gte('data_agendada', startOfDay(now).toISOString())
            .lte('data_agendada', endOfDay(now).toISOString());
        } else if (filters.periodo === 'amanha') {
          const amanha = addDays(now, 1);
          query = query
            .gte('data_agendada', startOfDay(amanha).toISOString())
            .lte('data_agendada', endOfDay(amanha).toISOString());
        } else if (filters.periodo === 'semana') {
          query = query
            .gte('data_agendada', startOfDay(now).toISOString())
            .lte('data_agendada', endOfWeek(now, { weekStartsOn: 1 }).toISOString());
        } else if (filters.periodo === 'atrasadas') {
          query = query
            .lt('data_agendada', startOfDay(now).toISOString())
            .eq('concluida', false);
        }
      }

      query = query.order('data_agendada', { ascending: true, nullsFirst: false });

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Tarefa[];
    },
  });
}

/** Retorna apenas as tarefas pendentes de hoje (widget do Dashboard). */
export function useTarefasHoje(limit = 5) {
  return useQuery<Tarefa[]>({
    queryKey: ['tarefas', 'hoje', limit],
    queryFn: async () => {
      const now = new Date();
      const { data, error } = await supabase
        .from('tarefas')
        .select('*')
        .gte('data_agendada', startOfDay(now).toISOString())
        .lte('data_agendada', endOfDay(now).toISOString())
        .eq('concluida', false)
        .order('data_agendada', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as Tarefa[];
    },
  });
}

/** Conta tarefas pendentes de um contato (usado em badges). */
export function useTarefasPendentesCount(contactId: string | null | undefined) {
  return useQuery<number>({
    queryKey: ['tarefas', 'pendentes', 'count', contactId],
    queryFn: async () => {
      if (!contactId) return 0;
      const { count, error } = await supabase
        .from('tarefas')
        .select('*', { count: 'exact', head: true })
        .eq('contact_id', contactId)
        .eq('concluida', false);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!contactId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useCreateTarefa() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: TarefaInsert) => {
      const titulo = input.titulo.trim();
      if (!titulo) throw new Error('Título da tarefa é obrigatório');

      const { data, error } = await supabase
        .from('tarefas')
        .insert({
          titulo,
          descricao: input.descricao ?? null,
          tipo: input.tipo ?? 'TAREFA',
          data_agendada: input.data_agendada ?? null,
          responsavel_id: input.responsavel_id ?? user?.id ?? null,
          contact_id: input.contact_id ?? null,
          leader_id: input.leader_id ?? null,
          demand_id: input.demand_id ?? null,
          board_item_id: input.board_item_id ?? null,
          created_by: user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Tarefa;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      toast.success(`Tarefa "${data.titulo}" criada`);
      logActivity({
        type: 'create',
        entity_type: 'tarefa',
        entity_id: data.id,
        entity_name: data.titulo,
        description: `Criou tarefa "${data.titulo}"`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar tarefa: ${error.message}`);
    },
  });
}

export function useUpdateTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Omit<TarefaInsert, 'created_by'>>;
    }) => {
      const { data, error } = await supabase
        .from('tarefas')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Tarefa;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      toast.success('Tarefa atualizada');
      logActivity({
        type: 'update',
        entity_type: 'tarefa',
        entity_id: data.id,
        entity_name: data.titulo,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar tarefa: ${error.message}`);
    },
  });
}

/**
 * Toggle de concluída. O trigger SQL `tarefas_set_concluida_em`
 * atualiza `concluida_em` automaticamente, então não precisamos
 * setar aqui no frontend.
 */
export function useToggleTarefaConcluida() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { data, error } = await supabase
        .from('tarefas')
        .update({ concluida })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Tarefa;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      if (data.concluida) {
        toast.success('Tarefa concluída');
        logActivity({
          type: 'status_change',
          entity_type: 'tarefa',
          entity_id: data.id,
          entity_name: data.titulo,
          description: `Concluiu "${data.titulo}"`,
        });
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar tarefa: ${error.message}`);
    },
  });
}

export function useDeleteTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: existing } = await supabase
        .from('tarefas')
        .select('titulo')
        .eq('id', id)
        .single();

      const { error } = await supabase.from('tarefas').delete().eq('id', id);
      if (error) throw error;
      return { id, titulo: existing?.titulo ?? 'tarefa' };
    },
    onSuccess: ({ id, titulo }) => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      toast.success('Tarefa excluída');
      logActivity({
        type: 'delete',
        entity_type: 'tarefa',
        entity_id: id,
        entity_name: titulo,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir tarefa: ${error.message}`);
    },
  });
}

// ============================================================================
// Bulk operations
// ============================================================================

export function useBulkConcluirTarefas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return 0;
      const { error } = await supabase
        .from('tarefas')
        .update({ concluida: true })
        .in('id', ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      toast.success(`${count} tarefa(s) concluída(s)`);
      logActivity({
        type: 'bulk_delete',
        entity_type: 'tarefa',
        description: `Concluiu ${count} tarefas em lote`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

export function useBulkAdiarTarefas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, novaData }: { ids: string[]; novaData: string }) => {
      if (ids.length === 0) return 0;
      const { error } = await supabase
        .from('tarefas')
        .update({ data_agendada: novaData })
        .in('id', ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      toast.success(`${count} tarefa(s) adiada(s)`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adiar: ${error.message}`);
    },
  });
}

export function useBulkDeleteTarefas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return 0;
      const { error } = await supabase.from('tarefas').delete().in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      toast.success(`${count} tarefa(s) excluída(s)`);
      logActivity({
        type: 'bulk_delete',
        entity_type: 'tarefa',
        description: `Excluiu ${count} tarefas em lote`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}
