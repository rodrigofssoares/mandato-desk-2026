import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface DemandTag {
  tag_id: string;
  tags: {
    id: string;
    nome: string;
    cor: string;
    categoria: string;
  };
}

export interface Demand {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  contact_id: string | null;
  created_by: string | null;
  responsible_id: string | null;
  neighborhood: string | null;
  created_at: string;
  updated_at: string;
  contact: { nome: string } | null;
  responsible: { nome: string } | null;
  demand_tags: DemandTag[];
}

export interface DemandFilters {
  status?: string;
  priority?: string;
  search?: string;
}

export interface DemandInsert {
  title: string;
  description?: string;
  status?: 'open' | 'in_progress' | 'resolved';
  priority?: 'low' | 'medium' | 'high';
  contact_id?: string | null;
  responsible_id?: string | null;
  neighborhood?: string;
  tag_ids?: string[];
}

export interface DemandUpdate extends Partial<DemandInsert> {
  id: string;
}

export function useDemands(filters?: DemandFilters) {
  return useQuery<Demand[]>({
    queryKey: ['demands', filters],
    queryFn: async () => {
      let query = supabase
        .from('demands')
        .select(`
          *,
          contact:contacts!contact_id(nome),
          responsible:profiles!responsible_id(nome),
          demand_tags(tag_id, tags(id, nome, cor, categoria))
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Demand[];
    },
  });
}

export function useCreateDemand() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: DemandInsert) => {
      const { tag_ids, ...demandData } = input;

      const { data, error } = await supabase
        .from('demands')
        .insert({
          ...demandData,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (tag_ids && tag_ids.length > 0) {
        const { error: tagError } = await supabase
          .from('demand_tags')
          .insert(tag_ids.map((tag_id) => ({ demand_id: data.id, tag_id })));
        if (tagError) throw tagError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      toast.success('Demanda criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar demanda: ${error.message}`);
    },
  });
}

export function useUpdateDemand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DemandUpdate) => {
      const { id, tag_ids, ...demandData } = input;

      const { data, error } = await supabase
        .from('demands')
        .update(demandData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (tag_ids !== undefined) {
        // Remove existing tags
        await supabase.from('demand_tags').delete().eq('demand_id', id);

        // Insert new tags
        if (tag_ids.length > 0) {
          const { error: tagError } = await supabase
            .from('demand_tags')
            .insert(tag_ids.map((tag_id) => ({ demand_id: id, tag_id })));
          if (tagError) throw tagError;
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      toast.success('Demanda atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar demanda: ${error.message}`);
    },
  });
}

export function useDeleteDemand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('demands').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      toast.success('Demanda excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir demanda: ${error.message}`);
    },
  });
}
