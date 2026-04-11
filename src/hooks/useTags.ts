import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

export interface Tag {
  id: string;
  nome: string;
  group_id: string;
  group_slug: string;
  group_label: string;
  cor: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contact_count: number;
}

export interface TagInsert {
  nome: string;
  group_id: string;
  cor?: string;
}

export interface TagUpdate extends Partial<TagInsert> {
  id: string;
}

export function useTags(groupId?: string) {
  return useQuery<Tag[]>({
    queryKey: ['tags', groupId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('tags')
        .select(`
          *,
          tag_group:tag_groups!inner(slug, label),
          contact_tags(count)
        `)
        .order('nome');

      if (groupId) {
        query = query.eq('group_id', groupId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((tag: any) => ({
        id: tag.id,
        nome: tag.nome,
        group_id: tag.group_id,
        group_slug: tag.tag_group?.slug ?? '',
        group_label: tag.tag_group?.label ?? '',
        cor: tag.cor,
        created_by: tag.created_by,
        created_at: tag.created_at,
        updated_at: tag.updated_at,
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
          nome: input.nome,
          group_id: input.group_id,
          cor: input.cor ?? '#6B7280',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Etiqueta criada com sucesso');
      logActivity({
        type: 'create',
        entity_type: 'tag',
        entity_name: data.nome,
        entity_id: data.id,
        description: `Criou a etiqueta "${data.nome}"`,
      });
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
      logActivity({ type: 'update', entity_type: 'tag', description: 'Atualizou uma etiqueta' });
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
      logActivity({ type: 'delete', entity_type: 'tag', description: 'Excluiu uma etiqueta' });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir etiqueta: ${error.message}`);
    },
  });
}

// ============================================================
// Bulk operations
// ============================================================

export interface BulkTagsPatch {
  group_id?: string;
  cor?: string;
}

export function useBulkUpdateTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: BulkTagsPatch }) => {
      if (ids.length === 0) return 0;
      if (!patch.group_id && !patch.cor) {
        throw new Error('Nenhum campo para atualizar');
      }

      const { error, count } = await supabase
        .from('tags')
        .update(patch, { count: 'exact' })
        .in('id', ids);

      if (error) throw error;
      return count ?? ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success(`${count} etiqueta(s) atualizada(s)`);
      logActivity({
        type: 'update',
        entity_type: 'tag',
        description: `Atualizou ${count} etiquetas em massa`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar em massa: ${error.message}`);
    },
  });
}

export function useBulkDeleteTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return 0;

      const { error, count } = await supabase
        .from('tags')
        .delete({ count: 'exact' })
        .in('id', ids);

      if (error) throw error;
      return count ?? ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success(`${count} etiqueta(s) excluída(s)`);
      logActivity({
        type: 'bulk_delete',
        entity_type: 'tag',
        description: `Excluiu ${count} etiquetas em massa`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir em massa: ${error.message}`);
    },
  });
}
