import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface Leader {
  id: string;
  nome: string;
  leadership_type: 'assessor_parlamentar' | 'lider_regional' | 'coordenador_area' | 'mobilizador' | 'multiplicador' | 'outro';
  region: string | null;
  city: string | null;
  neighborhoods: string[] | null;
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  instagram: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contact_count: number;
  declared_vote_count: number;
}

export interface LeaderFilters {
  search?: string;
  leadership_type?: string;
  active?: boolean;
}

export interface LeaderInsert {
  nome: string;
  leadership_type?: 'assessor_parlamentar' | 'lider_regional' | 'coordenador_area' | 'mobilizador' | 'outro';
  region?: string;
  city?: string;
  neighborhoods?: string[];
  whatsapp?: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  address?: string;
  instagram?: string;
  active?: boolean;
}

export interface LeaderUpdate extends Partial<LeaderInsert> {
  id: string;
}

export function useLeaders(filters?: LeaderFilters) {
  return useQuery<Leader[]>({
    queryKey: ['leaders', filters],
    queryFn: async () => {
      let query = supabase
        .from('leaders')
        .select('*')
        .order('nome');

      if (filters?.search) {
        query = query.ilike('nome', `%${filters.search}%`);
      }
      if (filters?.leadership_type) {
        query = query.eq('leadership_type', filters.leadership_type);
      }
      if (filters?.active !== undefined) {
        query = query.eq('active', filters.active);
      }

      const { data: leaders, error } = await query;
      if (error) throw error;

      // For each leader, get contact counts
      const leaderIds = (leaders ?? []).map((l: any) => l.id);

      if (leaderIds.length === 0) return [];

      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('leader_id, declarou_voto')
        .in('leader_id', leaderIds);

      if (contactsError) throw contactsError;

      const countMap: Record<string, { total: number; declared: number }> = {};
      for (const c of contacts ?? []) {
        if (!c.leader_id) continue;
        if (!countMap[c.leader_id]) {
          countMap[c.leader_id] = { total: 0, declared: 0 };
        }
        countMap[c.leader_id].total++;
        if (c.declarou_voto) {
          countMap[c.leader_id].declared++;
        }
      }

      return (leaders ?? []).map((leader: any) => ({
        ...leader,
        contact_count: countMap[leader.id]?.total ?? 0,
        declared_vote_count: countMap[leader.id]?.declared ?? 0,
      })) as Leader[];
    },
  });
}

export function useCreateLeader() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: LeaderInsert) => {
      const { data, error } = await supabase
        .from('leaders')
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaders'] });
      toast.success('Articulador criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar articulador: ${error.message}`);
    },
  });
}

export function useUpdateLeader() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LeaderUpdate) => {
      const { id, ...leaderData } = input;

      const { data, error } = await supabase
        .from('leaders')
        .update(leaderData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaders'] });
      toast.success('Articulador atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar articulador: ${error.message}`);
    },
  });
}

export function useDeleteLeader() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leaders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaders'] });
      toast.success('Articulador excluido com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir articulador: ${error.message}`);
    },
  });
}
