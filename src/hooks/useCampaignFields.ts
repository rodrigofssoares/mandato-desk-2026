import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

export interface CampaignField {
  id: string;
  slug: string;
  label: string;
  ordem: number;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignFieldInsert {
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

// ========================================================================
// Query: lista de campos ordenados
// ========================================================================
export function useCampaignFields() {
  return useQuery<CampaignField[]>({
    queryKey: ['campaign_fields'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_fields')
        .select('*')
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CampaignField[];
    },
  });
}

// ========================================================================
// Mutation: criar campo
// ========================================================================
export function useCreateCampaignField() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CampaignFieldInsert) => {
      const label = input.label.trim();
      if (!label) throw new Error('Nome do campo é obrigatório');

      const baseSlug = slugify(label);
      if (!baseSlug) throw new Error('Nome do campo inválido');

      // Garante slug único (append -2, -3 se necessário)
      let slug = baseSlug;
      let attempt = 1;
      while (true) {
        const { data: existing } = await supabase
          .from('campaign_fields')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();
        if (!existing) break;
        attempt += 1;
        slug = `${baseSlug}-${attempt}`;
      }

      // Calcula próxima ordem (fim da lista)
      const { count } = await supabase
        .from('campaign_fields')
        .select('*', { count: 'exact', head: true });
      const nextOrdem = input.ordem ?? (count ?? 0);

      const { data, error } = await supabase
        .from('campaign_fields')
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
      return data as CampaignField;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaign_fields'] });
      toast.success(`Campo "${data.label}" criado`);
      logActivity({
        type: 'create',
        entity_type: 'campaign_field',
        entity_name: data.label,
        entity_id: data.id,
        description: `Criou o campo de campanha "${data.label}"`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar campo: ${error.message}`);
    },
  });
}

// ========================================================================
// Mutation: renomear campo
// ========================================================================
export function useUpdateCampaignField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { data: existing, error: readError } = await supabase
        .from('campaign_fields')
        .select('is_system')
        .eq('id', id)
        .single();

      if (readError) throw readError;
      if ((existing as { is_system: boolean } | null)?.is_system) {
        throw new Error('Campos de sistema não podem ser renomeados');
      }

      const trimmed = label.trim();
      if (!trimmed) throw new Error('Nome do campo é obrigatório');

      const { data, error } = await supabase
        .from('campaign_fields')
        .update({ label: trimmed })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CampaignField;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_fields'] });
      toast.success('Campo atualizado');
      logActivity({
        type: 'update',
        entity_type: 'campaign_field',
        description: 'Renomeou um campo de campanha',
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar campo: ${error.message}`);
    },
  });
}

// ========================================================================
// Mutation: excluir campo
// ========================================================================
export function useDeleteCampaignField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaign_fields').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_fields'] });
      queryClient.invalidateQueries({ queryKey: ['contact_campaign_values'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Campo excluído');
      logActivity({
        type: 'delete',
        entity_type: 'campaign_field',
        description: 'Excluiu um campo de campanha',
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir campo: ${error.message}`);
    },
  });
}

// ========================================================================
// Mutation: reordenar campos (batch)
// ========================================================================
export function useReorderCampaignFields() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; ordem: number }[]) => {
      // Executa updates em paralelo (a tabela é pequena)
      const results = await Promise.all(
        items.map((it) =>
          supabase.from('campaign_fields').update({ ordem: it.ordem }).eq('id', it.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_fields'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reordenar: ${error.message}`);
    },
  });
}

// ========================================================================
// Query: valores marcados de um contato → Record<fieldId, boolean>
// ========================================================================
export function useContactCampaignValues(contactId: string | undefined) {
  return useQuery<Record<string, boolean>>({
    queryKey: ['contact_campaign_values', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_campaign_values')
        .select('campaign_field_id, valor')
        .eq('contact_id', contactId as string);

      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((row) => {
        map[row.campaign_field_id] = row.valor;
      });
      return map;
    },
  });
}

// ========================================================================
// Mutation: marcar/desmarcar campo para um contato
// ========================================================================
export function useToggleContactCampaignValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      fieldId,
      valor,
    }: {
      contactId: string;
      fieldId: string;
      valor: boolean;
    }) => {
      if (valor) {
        const { error } = await supabase
          .from('contact_campaign_values')
          .upsert(
            { contact_id: contactId, campaign_field_id: fieldId, valor: true },
            { onConflict: 'contact_id,campaign_field_id' },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contact_campaign_values')
          .delete()
          .eq('contact_id', contactId)
          .eq('campaign_field_id', fieldId);
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact_campaign_values', variables.contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar campo: ${error.message}`);
    },
  });
}

// ========================================================================
// Helper: grava um Record<fieldId, boolean> inteiro para um contato
// (usado após criar um contato novo com valores marcados)
// ========================================================================
export function useSetContactCampaignValues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      values,
    }: {
      contactId: string;
      values: Record<string, boolean>;
    }) => {
      const trueIds = Object.entries(values)
        .filter(([, v]) => v === true)
        .map(([id]) => id);

      if (trueIds.length === 0) return;

      const rows = trueIds.map((fieldId) => ({
        contact_id: contactId,
        campaign_field_id: fieldId,
        valor: true,
      }));

      const { error } = await supabase
        .from('contact_campaign_values')
        .upsert(rows, { onConflict: 'contact_id,campaign_field_id' });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact_campaign_values', variables.contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}
