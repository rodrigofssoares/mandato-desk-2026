import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

// ============================================================================
// Tipos
// ============================================================================

export type ChecklistAttachmentTipo = 'imagem' | 'video' | 'link';

export interface ChecklistAttachment {
  id: string;
  item_id: string;
  tipo: ChecklistAttachmentTipo;
  storage_path: string | null;
  url_externa: string | null;
  nome_original: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  rotulo: string | null;
  ordem: number;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  stage_id: string;
  texto: string;
  descricao: string | null;
  ordem: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  attachments: ChecklistAttachment[];
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Carrega todos os itens do checklist de uma etapa, com seus anexos embutidos.
 * Uma única round-trip via embed do PostgREST.
 */
export function useStageChecklist(stageId: string | null | undefined) {
  return useQuery<ChecklistItem[]>({
    queryKey: ['stage_checklist', stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await supabase
        .from('stage_checklist_items')
        .select('*, attachments:stage_checklist_attachments(*)')
        .eq('stage_id', stageId)
        .order('ordem', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => ({
        ...row,
        attachments: (row.attachments ?? []).sort(
          (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0),
        ),
      })) as ChecklistItem[];
    },
    enabled: !!stageId,
  });
}

/**
 * Indica se uma etapa tem ao menos 1 item OU 1 template configurado.
 * Usado para esconder/mostrar o ícone de checklist nas colunas do Kanban
 * (quando false, exibe estado vazio dentro do popup).
 */
export function useStageHasChecklist(stageId: string | null | undefined) {
  return useQuery<boolean>({
    queryKey: ['stage_has_checklist', stageId],
    queryFn: async () => {
      if (!stageId) return false;
      const [items, templates] = await Promise.all([
        supabase
          .from('stage_checklist_items')
          .select('id', { count: 'exact', head: true })
          .eq('stage_id', stageId),
        supabase
          .from('stage_message_templates')
          .select('id', { count: 'exact', head: true })
          .eq('stage_id', stageId),
      ]);
      return ((items.count ?? 0) + (templates.count ?? 0)) > 0;
    },
    enabled: !!stageId,
    staleTime: 30_000,
  });
}

// ============================================================================
// Mutations — Items
// ============================================================================

function invalidateChecklist(qc: ReturnType<typeof useQueryClient>, stageId: string) {
  qc.invalidateQueries({ queryKey: ['stage_checklist', stageId] });
  qc.invalidateQueries({ queryKey: ['stage_has_checklist', stageId] });
}

export function useCreateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stage_id: string; texto: string; descricao?: string | null }) => {
      const texto = input.texto.trim();
      if (!texto) throw new Error('Título da tarefa é obrigatório');

      const { count } = await supabase
        .from('stage_checklist_items')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', input.stage_id);

      const { data, error } = await supabase
        .from('stage_checklist_items')
        .insert({
          stage_id: input.stage_id,
          texto,
          descricao: input.descricao ?? null,
          ordem: count ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateChecklist(qc, data.stage_id);
      logActivity({
        type: 'create',
        entity_type: 'stage_checklist_item',
        entity_id: data.id,
        entity_name: data.texto,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar tarefa: ${error.message}`);
    },
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      stage_id: string;
      patch: Partial<Pick<ChecklistItem, 'texto' | 'descricao' | 'ordem'>>;
    }) => {
      const { data, error } = await supabase
        .from('stage_checklist_items')
        .update(input.patch)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return { ...data, stage_id: input.stage_id };
    },
    onSuccess: (data) => {
      invalidateChecklist(qc, data.stage_id);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar tarefa: ${error.message}`);
    },
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; stage_id: string }) => {
      // Anexos vinculados são removidos por CASCADE; objects órfãos no
      // storage ficam (limpeza dedicada via edge function fica como TODO).
      const { error } = await supabase
        .from('stage_checklist_items')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: ({ stage_id }) => {
      invalidateChecklist(qc, stage_id);
      toast.success('Tarefa excluída');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir tarefa: ${error.message}`);
    },
  });
}

export function useReorderChecklistItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stage_id: string; orderedIds: string[] }) => {
      const updates = input.orderedIds.map((id, idx) =>
        supabase.from('stage_checklist_items').update({ ordem: idx }).eq('id', id),
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
      return input;
    },
    onSuccess: ({ stage_id }) => {
      invalidateChecklist(qc, stage_id);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reordenar tarefas: ${error.message}`);
    },
  });
}

// ============================================================================
// Mutations — Attachments
// ============================================================================

export function useCreateAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      item_id: string;
      stage_id: string; // só para invalidar cache
      tipo: ChecklistAttachmentTipo;
      storage_path?: string | null;
      url_externa?: string | null;
      nome_original?: string | null;
      mime_type?: string | null;
      tamanho_bytes?: number | null;
      rotulo?: string | null;
    }) => {
      const { count } = await supabase
        .from('stage_checklist_attachments')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', input.item_id);

      const { data, error } = await supabase
        .from('stage_checklist_attachments')
        .insert({
          item_id: input.item_id,
          tipo: input.tipo,
          storage_path: input.storage_path ?? null,
          url_externa: input.url_externa ?? null,
          nome_original: input.nome_original ?? null,
          mime_type: input.mime_type ?? null,
          tamanho_bytes: input.tamanho_bytes ?? null,
          rotulo: input.rotulo ?? null,
          ordem: count ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return { attachment: data, stage_id: input.stage_id };
    },
    onSuccess: ({ stage_id }) => {
      invalidateChecklist(qc, stage_id);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar anexo: ${error.message}`);
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      stage_id: string;
      storage_path?: string | null;
    }) => {
      // Remove o object do storage primeiro (best-effort) — se falhar, ainda
      // removemos o row para evitar lixo no banco. Órfão no storage não bloqueia.
      if (input.storage_path) {
        await supabase.storage.from('stage-checklist').remove([input.storage_path]);
      }
      const { error } = await supabase
        .from('stage_checklist_attachments')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: ({ stage_id }) => {
      invalidateChecklist(qc, stage_id);
      toast.success('Anexo removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover anexo: ${error.message}`);
    },
  });
}
