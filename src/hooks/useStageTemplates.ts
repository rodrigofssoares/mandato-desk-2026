import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

// ============================================================================
// Tipos
// ============================================================================

export interface StageMessageTemplate {
  id: string;
  stage_id: string;
  titulo: string;
  conteudo: string;
  ordem: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Queries
// ============================================================================

export function useStageTemplates(stageId: string | null | undefined) {
  return useQuery<StageMessageTemplate[]>({
    queryKey: ['stage_templates', stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await supabase
        .from('stage_message_templates')
        .select('*')
        .eq('stage_id', stageId)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StageMessageTemplate[];
    },
    enabled: !!stageId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

function invalidate(qc: ReturnType<typeof useQueryClient>, stageId: string) {
  qc.invalidateQueries({ queryKey: ['stage_templates', stageId] });
  qc.invalidateQueries({ queryKey: ['stage_has_checklist', stageId] });
}

export function useCreateStageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stage_id: string; titulo: string; conteudo: string }) => {
      const titulo = input.titulo.trim();
      const conteudo = input.conteudo;
      if (!titulo) throw new Error('Título do template é obrigatório');
      if (!conteudo.trim()) throw new Error('Conteúdo do template é obrigatório');

      const { count } = await supabase
        .from('stage_message_templates')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', input.stage_id);

      const { data, error } = await supabase
        .from('stage_message_templates')
        .insert({
          stage_id: input.stage_id,
          titulo,
          conteudo,
          ordem: count ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as StageMessageTemplate;
    },
    onSuccess: (data) => {
      invalidate(qc, data.stage_id);
      logActivity({
        type: 'create',
        entity_type: 'stage_message_template',
        entity_id: data.id,
        entity_name: data.titulo,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar template: ${error.message}`);
    },
  });
}

export function useUpdateStageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      stage_id: string;
      patch: Partial<Pick<StageMessageTemplate, 'titulo' | 'conteudo' | 'ordem'>>;
    }) => {
      const { data, error } = await supabase
        .from('stage_message_templates')
        .update(input.patch)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return { ...data, stage_id: input.stage_id } as StageMessageTemplate;
    },
    onSuccess: (data) => {
      invalidate(qc, data.stage_id);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar template: ${error.message}`);
    },
  });
}

export function useDeleteStageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; stage_id: string }) => {
      const { error } = await supabase
        .from('stage_message_templates')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: ({ stage_id }) => {
      invalidate(qc, stage_id);
      toast.success('Template excluído');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir template: ${error.message}`);
    },
  });
}

export function useReorderStageTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stage_id: string; orderedIds: string[] }) => {
      const updates = input.orderedIds.map((id, idx) =>
        supabase.from('stage_message_templates').update({ ordem: idx }).eq('id', id),
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
      return input;
    },
    onSuccess: ({ stage_id }) => {
      invalidate(qc, stage_id);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reordenar templates: ${error.message}`);
    },
  });
}
