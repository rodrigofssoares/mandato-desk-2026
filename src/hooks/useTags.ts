import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface Tag {
  id: string;
  name: string;
  category: 'professionals' | 'relationships' | 'demands';
  color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contact_count: number;
}

export interface TagInsert {
  name: string;
  category: 'professionals' | 'relationships' | 'demands';
  color?: string;
}

export interface TagUpdate extends Partial<TagInsert> {
  id: string;
}

export function useTags(category?: string) {
  return useQuery<Tag[]>({
    queryKey: ['tags', category],
    queryFn: async () => {
      let query = supabase
        .from('tags')
        .select(`
          *,
          contact_tags(count)
        `)
        .order('name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((tag: any) => ({
        ...tag,
        contact_count: tag.contact_tags?.[0]?.count ?? 0,
      })) as Tag[];
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: TagInsert) => {
      const { data, error } = await supabase
        .from('tags')
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
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Etiqueta criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar etiqueta: ${error.message}`);
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TagUpdate) => {
      const { id, ...tagData } = input;

      const { data, error } = await supabase
        .from('tags')
        .update(tagData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Etiqueta atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar etiqueta: ${error.message}`);
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Etiqueta excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir etiqueta: ${error.message}`);
    },
  });
}
