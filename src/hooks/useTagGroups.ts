import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

export const MAX_TAG_GROUPS = 7;

export interface TagGroup {
  id: string;
  slug: string;
  label: string;
  ordem: number;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TagGroupInsert {
  label: string;
  ordem?: number;
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function useTagGroups() {
  return useQuery<TagGroup[]>({
    queryKey: ['tag_groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tag_groups')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      return (data ?? []) as TagGroup[];
    },
  });
}

export function useCreateTagGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: TagGroupInsert) => {
      // Validação no cliente (o trigger no banco também bloqueia)
      const { count, error: countError } = await supabase
        .from('tag_groups')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      if ((count ?? 0) >= MAX_TAG_GROUPS) {
        throw new Error(`Limite máximo de ${MAX_TAG_GROUPS} grupos atingido`);
      }

      const slug = slugify(input.label);
      if (!slug) throw new Error('Nome do grupo inválido');

      const nextOrdem = input.ordem ?? (count ?? 0);

      const { data, error } = await supabase
        .from('tag_groups')
        .insert({
          slug,
          label: input.label.trim(),
          ordem: nextOrdem,
          is_system: false,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TagGroup;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tag_groups'] });
      toast.success(`Grupo "${data.label}" criado`);
      logActivity({
        type: 'create',
        entity_type: 'tag_group',
        entity_name: data.label,
        entity_id: data.id,
        description: `Criou o grupo de etiquetas "${data.label}"`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar grupo: ${error.message}`);
    },
  });
}

export function useUpdateTagGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      // Bloqueio extra: não permite renomear grupos de sistema (RLS também bloqueia)
      const { data: existing, error: readError } = await supabase
        .from('tag_groups')
        .select('is_system')
        .eq('id', id)
        .single();

      if (readError) throw readError;
      if ((existing as any)?.is_system) {
        throw new Error('Grupos de sistema não podem ser renomeados');
      }

      const { data, error } = await supabase
        .from('tag_groups')
        .update({ label: label.trim() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as TagGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag_groups'] });
      toast.success('Grupo atualizado');
      logActivity({ type: 'update', entity_type: 'tag_group', description: 'Renomeou um grupo de etiquetas' });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar grupo: ${error.message}`);
    },
  });
}

export function useDeleteTagGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Bloqueia se tiver etiquetas referenciando o grupo
      const { count, error: countError } = await supabase
        .from('tags')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', id);

      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error(
          `Este grupo contém ${count} etiqueta(s). Mova ou exclua as etiquetas antes.`
        );
      }

      const { error } = await supabase.from('tag_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag_groups'] });
      toast.success('Grupo excluído');
      logActivity({ type: 'delete', entity_type: 'tag_group', description: 'Excluiu um grupo de etiquetas' });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir grupo: ${error.message}`);
    },
  });
}
