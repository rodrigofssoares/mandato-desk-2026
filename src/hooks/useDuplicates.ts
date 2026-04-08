import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

// ---------- Types ----------

export interface DuplicateContact {
  id: string;
  nome: string;
  nome_whatsapp?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  telefone?: string | null;
  genero?: string | null;
  data_nascimento?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  declarou_voto?: boolean;
  ranking?: number;
  leader_id?: string | null;
  origem?: string | null;
  observacoes?: string | null;
  notas_assessor?: string | null;
  is_favorite?: boolean;
  ultimo_contato?: string | null;
  em_canal_whatsapp?: boolean;
  aceita_whatsapp?: boolean;
  created_at: string;
  updated_at?: string;
  merged_into?: string | null;
  contact_tags?: {
    tag_id: string;
    tags: { id: string; nome: string; cor?: string | null; categoria?: string | null };
  }[];
}

export interface DuplicateGroup {
  match_field: 'whatsapp' | 'email' | 'nome';
  match_value: string;
  contacts: DuplicateContact[];
}

// ---------- Helpers ----------

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Remove country code 55 (Brazil)
  if (digits.length >= 12 && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

function buildGroupsClientSide(contacts: DuplicateContact[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seenIds = new Set<string>();

  // Group by normalized whatsapp
  const byWhatsapp = new Map<string, DuplicateContact[]>();
  for (const c of contacts) {
    const normalized = normalizePhone(c.whatsapp);
    if (!normalized) continue;
    const bucket = byWhatsapp.get(normalized) ?? [];
    bucket.push(c);
    byWhatsapp.set(normalized, bucket);
  }
  for (const [, members] of byWhatsapp.entries()) {
    if (members.length > 1) {
      // Use the first contact's original whatsapp as display value
      const displayValue = members[0].whatsapp ?? '';
      groups.push({ match_field: 'whatsapp', match_value: displayValue, contacts: [...members] });
      members.forEach((m) => seenIds.add(m.id));
    }
  }

  // Group by lowercase email (skip already grouped)
  const byEmail = new Map<string, DuplicateContact[]>();
  for (const c of contacts) {
    if (seenIds.has(c.id) || !c.email) continue;
    const key = c.email.trim().toLowerCase();
    if (!key) continue;
    const bucket = byEmail.get(key) ?? [];
    bucket.push(c);
    byEmail.set(key, bucket);
  }
  for (const [, members] of byEmail.entries()) {
    if (members.length > 1) {
      const displayValue = members[0].email ?? '';
      groups.push({ match_field: 'email', match_value: displayValue, contacts: [...members] });
      members.forEach((m) => seenIds.add(m.id));
    }
  }

  // Group by lowercase nome (skip already grouped)
  const byNome = new Map<string, DuplicateContact[]>();
  for (const c of contacts) {
    if (seenIds.has(c.id) || !c.nome) continue;
    const key = c.nome.trim().toLowerCase();
    if (!key) continue;
    const bucket = byNome.get(key) ?? [];
    bucket.push(c);
    byNome.set(key, bucket);
  }
  for (const [, members] of byNome.entries()) {
    if (members.length > 1) {
      const displayValue = members[0].nome;
      groups.push({ match_field: 'nome', match_value: displayValue, contacts: [...members] });
    }
  }

  return groups;
}

// ---------- useDuplicateCount ----------

export function useDuplicateCount() {
  return useQuery({
    queryKey: ['duplicate-count'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, nome, whatsapp, email, telefone, created_at')
        .is('merged_into', null);

      if (error) throw error;

      const contacts = (data ?? []) as Pick<
        DuplicateContact,
        'id' | 'nome' | 'whatsapp' | 'email' | 'telefone' | 'created_at'
      >[];

      let duplicateCount = 0;
      const seenIds = new Set<string>();

      // By whatsapp
      const byWhatsapp = new Map<string, string[]>();
      for (const c of contacts) {
        const normalized = normalizePhone(c.whatsapp);
        if (!normalized) continue;
        const bucket = byWhatsapp.get(normalized) ?? [];
        bucket.push(c.id);
        byWhatsapp.set(normalized, bucket);
      }
      for (const [, ids] of byWhatsapp.entries()) {
        if (ids.length > 1) {
          duplicateCount += ids.length - 1;
          ids.forEach((id) => seenIds.add(id));
        }
      }

      // By email
      const byEmail = new Map<string, string[]>();
      for (const c of contacts) {
        if (seenIds.has(c.id) || !c.email) continue;
        const key = c.email.trim().toLowerCase();
        if (!key) continue;
        const bucket = byEmail.get(key) ?? [];
        bucket.push(c.id);
        byEmail.set(key, bucket);
      }
      for (const [, ids] of byEmail.entries()) {
        if (ids.length > 1) {
          duplicateCount += ids.length - 1;
          ids.forEach((id) => seenIds.add(id));
        }
      }

      // By nome
      const byNome = new Map<string, string[]>();
      for (const c of contacts) {
        if (seenIds.has(c.id) || !c.nome) continue;
        const key = c.nome.trim().toLowerCase();
        if (!key) continue;
        const bucket = byNome.get(key) ?? [];
        bucket.push(c.id);
        byNome.set(key, bucket);
      }
      for (const [, ids] of byNome.entries()) {
        if (ids.length > 1) {
          duplicateCount += ids.length - 1;
        }
      }

      return duplicateCount;
    },
  });
}

// ---------- useDuplicateGroups ----------

export function useDuplicateGroups(enabled: boolean) {
  return useQuery({
    queryKey: ['duplicate-groups'],
    enabled,
    queryFn: async (): Promise<DuplicateGroup[]> => {
      // Client-side detection with full contact data
      const { data, error } = await supabase
        .from('contacts')
        .select('*, contact_tags(tag_id, tags(id, nome, cor, categoria))')
        .is('merged_into', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const contacts = (data ?? []) as DuplicateContact[];
      return buildGroupsClientSide(contacts);
    },
  });
}

// ---------- useMergeContacts ----------

interface MergeContactsParams {
  keptId: string;
  deletedId: string;
  mergedData: Record<string, unknown>;
  selectedTagIds: string[];
}

export function useMergeContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ keptId, deletedId, mergedData, selectedTagIds }: MergeContactsParams) => {
      // 1. Update kept contact with merged data
      const { error: updateError } = await supabase
        .from('contacts')
        .update({ ...mergedData, updated_at: new Date().toISOString() })
        .eq('id', keptId);
      if (updateError) throw updateError;

      // 2. Transfer demands from deleted contact to kept contact
      const { error: demandsError } = await supabase
        .from('demands')
        .update({ contact_id: keptId })
        .eq('contact_id', deletedId);
      if (demandsError) throw demandsError;

      // 3. Delete existing tags of kept contact
      const { error: deleteKeptTagsError } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', keptId);
      if (deleteKeptTagsError) throw deleteKeptTagsError;

      // 4. Insert selected tags for kept contact
      if (selectedTagIds.length > 0) {
        const tagRows = selectedTagIds.map((tag_id) => ({ contact_id: keptId, tag_id }));
        const { error: insertTagsError } = await supabase.from('contact_tags').insert(tagRows);
        if (insertTagsError) throw insertTagsError;
      }

      // 5. Delete tags of deleted contact
      const { error: deleteDeletedTagsError } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', deletedId);
      if (deleteDeletedTagsError) throw deleteDeletedTagsError;

      // 6. Record the merge in contact_merges
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      const { error: mergeRecordError } = await supabase.from('contact_merges').insert({
        kept_contact_id: keptId,
        deleted_contact_id: deletedId,
        merged_fields: mergedData,
        merged_by: userId,
      });
      if (mergeRecordError) throw mergeRecordError;

      // 7. Mark deleted contact as merged
      const { error: markDeletedError } = await supabase
        .from('contacts')
        .update({ merged_into: keptId })
        .eq('id', deletedId);
      if (markDeletedError) throw markDeletedError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-count'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-groups'] });
      toast.success('Contatos mesclados com sucesso');
      logActivity({ type: 'merge', entity_type: 'contact', description: 'Mesclou contatos duplicados' });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao mesclar contatos: ${error.message}`);
    },
  });
}

// ---------- useDeleteSingleDuplicate ----------

export function useDeleteSingleDuplicate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-count'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-groups'] });
      toast.success('Contato excluido com sucesso');
      logActivity({ type: 'delete', entity_type: 'contact', description: 'Excluiu um contato duplicado' });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir contato: ${error.message}`);
    },
  });
}

// ---------- useBulkDeleteDuplicates ----------

interface BulkDeleteParams {
  groups: DuplicateGroup[];
  strategy: 'keep_newest' | 'keep_oldest';
}

export function useBulkDeleteDuplicates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groups, strategy }: BulkDeleteParams) => {
      const idsToDelete: string[] = [];

      for (const group of groups) {
        if (group.contacts.length < 2) continue;

        // Sort by created_at ascending (oldest first)
        const sorted = [...group.contacts].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        if (strategy === 'keep_oldest') {
          // Keep the first (oldest), delete the rest
          sorted.slice(1).forEach((c) => idsToDelete.push(c.id));
        } else {
          // keep_newest: keep the last (newest), delete the rest
          sorted.slice(0, -1).forEach((c) => idsToDelete.push(c.id));
        }
      }

      if (idsToDelete.length === 0) return 0;

      // Remove duplicates from the list (a contact may appear in multiple groups)
      const uniqueIds = [...new Set(idsToDelete)];

      const { error } = await supabase.from('contacts').delete().in('id', uniqueIds);
      if (error) throw error;

      return uniqueIds.length;
    },
    onSuccess: (deletedCount) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-count'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-groups'] });
      toast.success(
        `${deletedCount} contato${deletedCount !== 1 ? 's' : ''} duplicado${deletedCount !== 1 ? 's' : ''} removido${deletedCount !== 1 ? 's' : ''} com sucesso`
      );
      logActivity({ type: 'bulk_delete', entity_type: 'contact', description: `Excluiu ${deletedCount} contatos duplicados` });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover duplicatas: ${error.message}`);
    },
  });
}
