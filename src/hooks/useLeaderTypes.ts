import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

export interface LeaderType {
  id: string;
  slug: string;
  label: string;
  ordem: number;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaderTypeInsert {
  label: string;
  ordem?: number;
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function useLeaderTypes() {
  return useQuery<LeaderType[]>({
    queryKey: ['leader_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leader_types')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      return (data ?? []) as LeaderType[];
    },
  });
}

export function useCreateLeaderType() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: LeaderTypeInsert) => {
      const label = input.label.trim();
      if (!label) throw new Error('Nome do tipo é obrigatório');

      const slug = slugify(label);
      if (!slug) throw new Error('Nome do tipo inválido');

      // Próxima ordem = max(ordem) + 1 (mas abaixo de "outro" que fica em 99)
      const { data: existing, error: readError } = await supabase
        .from('leader_types')
        .select('ordem')
        .lt('ordem', 99)
        .order('ordem', { ascending: false })
        .limit(1);

      if (readError) throw readError;

      const nextOrdem = input.ordem ?? ((existing?.[0]?.ordem ?? -1) + 1);

      const { data, error } = await supabase
        .from('leader_types')
        .insert({
          slug,
          label,
          ordem: nextOrdem,
          is_system: false,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as LeaderType;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leader_types'] });
      toast.success(`Tipo "${data.label}" criado`);
      logActivity({
        type: 'create',
        entity_type: 'leader_type',
        entity_name: data.label,
        entity_id: data.id,
        description: `Criou o tipo de articulador "${data.label}"`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar tipo: ${error.message}`);
    },
  });
}

export function useUpdateLeaderType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { data: existing, error: readError } = await supabase
        .from('leader_types')
        .select('is_system')
        .eq('id', id)
        .single();

      if (readError) throw readError;
      if ((existing as any)?.is_system) {
        throw new Error('Tipos de sistema não podem ser renomeados');
      }

      const { data, error } = await supabase
        .from('leader_types')
        .update({ label: label.trim() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as LeaderType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leader_types'] });
      toast.success('Tipo atualizado');
      logActivity({
        type: 'update',
        entity_type: 'leader_type',
        description: 'Renomeou um tipo de articulador',
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar tipo: ${error.message}`);
    },
  });
}

export function useDeleteLeaderType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { count, error: countError } = await supabase
        .from('leaders')
        .select('*', { count: 'exact', head: true })
        .eq('leader_type_id', id);

      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error(
          `Este tipo está em uso por ${count} articulador(es). Reatribua antes de excluir.`
        );
      }

      const { error } = await supabase.from('leader_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leader_types'] });
      toast.success('Tipo excluído');
      logActivity({
        type: 'delete',
        entity_type: 'leader_type',
        description: 'Excluiu um tipo de articulador',
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir tipo: ${error.message}`);
    },
  });
}
