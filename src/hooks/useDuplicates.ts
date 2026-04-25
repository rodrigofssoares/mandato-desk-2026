import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';
import { phoneComparisonKey } from '@/lib/normalization';

// ---------- Types ----------

export interface DuplicateContact {
  id: string;
  nome: string;
  nome_whatsapp?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
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
    tags: { id: string; nome: string; cor?: string | null };
  }[];
}

export interface DuplicateGroup {
  match_field: 'whatsapp' | 'email' | 'nome';
  match_value: string;
  contacts: DuplicateContact[];
}

// ---------- Helpers ----------

function buildGroupsClientSide(contacts: DuplicateContact[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seenIds = new Set<string>();

  // Group by normalized whatsapp OR telefone (qualquer um bate)
  const byWhatsapp = new Map<string, DuplicateContact[]>();
  for (const c of contacts) {
    const normalized = phoneComparisonKey(c.whatsapp) || phoneComparisonKey(c.telefone);
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

// ---------- Dismissed groups (false positives ocultados pelo usuario) ----------

interface DismissedGroupRow {
  match_field: string;
  match_value: string;
}

async function fetchDismissedKeys(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('dismissed_duplicate_groups')
    .select('match_field, match_value');
  if (error) throw error;
  const set = new Set<string>();
  for (const row of (data ?? []) as DismissedGroupRow[]) {
    set.add(`${row.match_field}:${row.match_value.trim().toLowerCase()}`);
  }
  return set;
}

function dismissalKey(matchField: string, matchValue: string): string {
  return `${matchField}:${(matchValue ?? '').trim().toLowerCase()}`;
}

// ---------- useDuplicateCount ----------

export function useDuplicateCount() {
  return useQuery({
    queryKey: ['duplicate-count'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      // PostgREST corta em 1000 linhas por request; com bases grandes precisamos
      // paginar ou duplicatas entre registros "antigos" e "recentes" ficam
      // invisíveis (cada lote só enxerga o próprio intervalo).
      type CountRow = Pick<
        DuplicateContact,
        'id' | 'nome' | 'whatsapp' | 'email' | 'telefone' | 'created_at'
      >;
      const contacts: CountRow[] = [];
      const PAGE = 1000;
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('contacts')
          .select('id, nome, whatsapp, email, telefone, created_at')
          .is('merged_into', null)
          .order('created_at', { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        const batch = (data ?? []) as CountRow[];
        contacts.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
      }

      // Carrega lista de grupos dispensados pelo usuario p/ ignorar na contagem.
      const dismissed = await fetchDismissedKeys();

      let duplicateCount = 0;
      const seenIds = new Set<string>();

      // By whatsapp OR telefone (qualquer um bate, normalizados)
      // Mantemos tambem o telefone original do primeiro contato p/ checar dispensa.
      const byWhatsapp = new Map<string, { ids: string[]; display: string }>();
      for (const c of contacts) {
        const normalized = phoneComparisonKey(c.whatsapp) || phoneComparisonKey(c.telefone);
        if (!normalized) continue;
        const bucket = byWhatsapp.get(normalized) ?? { ids: [], display: c.whatsapp ?? c.telefone ?? '' };
        bucket.ids.push(c.id);
        byWhatsapp.set(normalized, bucket);
      }
      for (const [, bucket] of byWhatsapp.entries()) {
        if (bucket.ids.length > 1 && !dismissed.has(dismissalKey('whatsapp', bucket.display))) {
          duplicateCount += bucket.ids.length - 1;
          bucket.ids.forEach((id) => seenIds.add(id));
        }
      }

      // By email
      const byEmail = new Map<string, { ids: string[]; display: string }>();
      for (const c of contacts) {
        if (seenIds.has(c.id) || !c.email) continue;
        const key = c.email.trim().toLowerCase();
        if (!key) continue;
        const bucket = byEmail.get(key) ?? { ids: [], display: c.email };
        bucket.ids.push(c.id);
        byEmail.set(key, bucket);
      }
      for (const [, bucket] of byEmail.entries()) {
        if (bucket.ids.length > 1 && !dismissed.has(dismissalKey('email', bucket.display))) {
          duplicateCount += bucket.ids.length - 1;
          bucket.ids.forEach((id) => seenIds.add(id));
        }
      }

      // By nome
      const byNome = new Map<string, { ids: string[]; display: string }>();
      for (const c of contacts) {
        if (seenIds.has(c.id) || !c.nome) continue;
        const key = c.nome.trim().toLowerCase();
        if (!key) continue;
        const bucket = byNome.get(key) ?? { ids: [], display: c.nome };
        bucket.ids.push(c.id);
        byNome.set(key, bucket);
      }
      for (const [, bucket] of byNome.entries()) {
        if (bucket.ids.length > 1 && !dismissed.has(dismissalKey('nome', bucket.display))) {
          duplicateCount += bucket.ids.length - 1;
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
      // Pagina p/ pegar toda a base (senão só os 1000 primeiros entram no
      // cálculo — duplicatas entre registros antigos e recentes ficavam fora).
      const contacts: DuplicateContact[] = [];
      const PAGE = 1000;
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('contacts')
          .select('*, contact_tags(tag_id, tags(id, nome, cor))')
          .is('merged_into', null)
          .order('created_at', { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        const batch = (data ?? []) as DuplicateContact[];
        contacts.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
      }

      const allGroups = buildGroupsClientSide(contacts);
      const dismissed = await fetchDismissedKeys();
      // Remove grupos que o usuario ja marcou como "nao sao duplicatas".
      return allGroups.filter((g) => !dismissed.has(dismissalKey(g.match_field, g.match_value)));
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
      // 0. Snapshot do contato a ser consumido (antes de qualquer modificacao)
      const { data: snapshotData, error: snapshotError } = await supabase
        .from('contacts')
        .select('*, contact_tags(tag_id, tags(id, nome, cor))')
        .eq('id', deletedId)
        .single();
      if (snapshotError) throw snapshotError;
      if (!snapshotData) throw new Error('Contato a ser mesclado não encontrado');

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
        deleted_contact_snapshot: snapshotData,
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
      toast.success('Contato excluído com sucesso');
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

// ---------- useDismissDuplicateGroups ----------

interface DismissParams {
  groups: DuplicateGroup[];
  reason?: string;
}

/**
 * Marca grupos de duplicados como "nao sao duplicatas". Insere em
 * dismissed_duplicate_groups; o filtro do useDuplicateGroups remove esses
 * grupos do retorno em sessoes futuras (e na proxima invalidacao).
 */
export function useDismissDuplicateGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groups, reason }: DismissParams): Promise<number> => {
      if (groups.length === 0) return 0;
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;

      const rows = groups.map((g) => ({
        match_field: g.match_field,
        match_value: g.match_value,
        reason: reason ?? null,
        dismissed_by: userId,
      }));

      // upsert com onConflict p/ evitar UNIQUE violation se o grupo ja foi dispensado.
      const { error } = await supabase
        .from('dismissed_duplicate_groups')
        .upsert(rows, { onConflict: 'match_field,match_value', ignoreDuplicates: true });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-count'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-groups'] });
      if (count > 0) {
        toast.success(`${count} grupo${count !== 1 ? 's' : ''} marcado${count !== 1 ? 's' : ''} como "nao sao duplicatas"`);
        logActivity({
          type: 'merge',
          entity_type: 'contact',
          description: `Dispensou ${count} grupos de duplicados como falso positivo`,
        });
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao dispensar grupos: ${error.message}`);
    },
  });
}

// ---------- useAutoMergeDuplicates ----------

// Campos que comparamos para detectar conflito real entre contatos do mesmo
// grupo. Telefones usam phoneComparisonKey (ignoram +55/55/sem DDI). E-mail
// é case-insensitive. Outros campos viram lower+trim.
const COMPARABLE_FIELDS: { key: keyof DuplicateContact; type: 'text' | 'phone' | 'email' }[] = [
  { key: 'nome', type: 'text' },
  { key: 'nome_whatsapp', type: 'text' },
  { key: 'whatsapp', type: 'phone' },
  { key: 'telefone', type: 'phone' },
  { key: 'email', type: 'email' },
  { key: 'genero', type: 'text' },
  { key: 'data_nascimento', type: 'text' },
  { key: 'logradouro', type: 'text' },
  { key: 'numero', type: 'text' },
  { key: 'complemento', type: 'text' },
  { key: 'bairro', type: 'text' },
  { key: 'cidade', type: 'text' },
  { key: 'estado', type: 'text' },
  { key: 'cep', type: 'text' },
  { key: 'instagram', type: 'text' },
  { key: 'twitter', type: 'text' },
  { key: 'tiktok', type: 'text' },
  { key: 'youtube', type: 'text' },
  { key: 'leader_id', type: 'text' },
  { key: 'origem', type: 'text' },
  { key: 'observacoes', type: 'text' },
  { key: 'notas_assessor', type: 'text' },
];

function normalizeFieldValue(val: unknown, type: 'text' | 'phone' | 'email'): string {
  if (val === null || val === undefined || val === '') return '';
  if (type === 'phone') return phoneComparisonKey(String(val));
  const s = String(val).trim();
  if (type === 'email') return s.toLowerCase();
  return s.toLowerCase();
}

/**
 * Detecta conflito de campo dentro de um grupo de duplicados.
 * Retorna a lista de chaves que têm 2+ valores não-vazios distintos.
 * Tags NÃO contam como conflito — sempre são unidas.
 */
function detectConflictingFields(contacts: DuplicateContact[]): string[] {
  const conflicting: string[] = [];
  for (const { key, type } of COMPARABLE_FIELDS) {
    const distinct = new Set<string>();
    for (const c of contacts) {
      const norm = normalizeFieldValue((c as unknown as Record<string, unknown>)[key as string], type);
      if (norm) distinct.add(norm);
    }
    if (distinct.size > 1) conflicting.push(String(key));
  }
  return conflicting;
}

/**
 * Escolhe qual contato do grupo mantém. Critério (em ordem):
 *   1. Tem whatsapp com prefixo 55 (formato canônico do banco)
 *   2. Mais campos preenchidos
 *   3. Mais recente (updated_at, fallback created_at)
 */
function pickWinner(contacts: DuplicateContact[]): DuplicateContact {
  const score = (c: DuplicateContact) => {
    const digits = String(c.whatsapp ?? '').replace(/\D/g, '');
    const has55 = (digits.length === 12 || digits.length === 13) && digits.startsWith('55') ? 1 : 0;
    let filled = 0;
    for (const v of Object.values(c)) {
      if (v !== null && v !== undefined && v !== '' && !Array.isArray(v)) filled++;
    }
    const time = new Date(c.updated_at ?? c.created_at).getTime();
    return { has55, filled, time };
  };
  return [...contacts].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa.has55 !== sb.has55) return sb.has55 - sa.has55;
    if (sa.filled !== sb.filled) return sb.filled - sa.filled;
    return sb.time - sa.time;
  })[0];
}

/**
 * Para cada campo do schema do contato, pega o valor não-vazio do GRUPO
 * quando o winner está vazio. (Sem conflito é pré-condição: só há um valor
 * possível por campo no grupo.)
 */
function computeMergedFields(group: DuplicateContact[], winner: DuplicateContact): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const wRec = winner as unknown as Record<string, unknown>;
  for (const { key } of COMPARABLE_FIELDS) {
    const winnerVal = wRec[key as string];
    if (winnerVal !== null && winnerVal !== undefined && winnerVal !== '') continue;
    for (const c of group) {
      if (c.id === winner.id) continue;
      const v = (c as unknown as Record<string, unknown>)[key as string];
      if (v !== null && v !== undefined && v !== '') {
        merged[key as string] = v;
        break;
      }
    }
  }
  return merged;
}

export interface AutoMergeResult {
  autoResolved: number;
  conflictsRemaining: number;
  errors: number;
  conflictingFields: Map<string, string[]>; // groupValue -> fields
}

export function useAutoMergeDuplicates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groups: DuplicateGroup[]): Promise<AutoMergeResult> => {
      const result: AutoMergeResult = {
        autoResolved: 0,
        conflictsRemaining: 0,
        errors: 0,
        conflictingFields: new Map(),
      };

      // Filtra só grupos por whatsapp/telefone (foco do pedido). Email/nome
      // ficam pra revisão manual — tem mais risco de falso-positivo.
      const phoneGroups = groups.filter((g) => g.match_field === 'whatsapp' && g.contacts.length >= 2);

      // Processa em paralelo em lotes pequenos p/ não estourar o cliente
      const BATCH = 5;
      for (let i = 0; i < phoneGroups.length; i += BATCH) {
        const slice = phoneGroups.slice(i, i + BATCH);
        await Promise.all(
          slice.map(async (group) => {
            const conflictingFields = detectConflictingFields(group.contacts);
            if (conflictingFields.length > 0) {
              result.conflictsRemaining++;
              result.conflictingFields.set(group.match_value, conflictingFields);
              return;
            }

            try {
              const winner = pickWinner(group.contacts);
              const losers = group.contacts.filter((c) => c.id !== winner.id);
              const loserIds = losers.map((l) => l.id);

              // 1. Preenche campos vazios do winner com valores dos losers
              const mergedFields = computeMergedFields(group.contacts, winner);
              if (Object.keys(mergedFields).length > 0) {
                const { error } = await supabase
                  .from('contacts')
                  .update({ ...mergedFields, updated_at: new Date().toISOString() })
                  .eq('id', winner.id);
                if (error) throw error;
              }

              // 2. União das etiquetas: pega tags dos losers que o winner não tem
              const winnerTagIds = new Set((winner.contact_tags ?? []).map((t) => t.tag_id));
              const newTagIds = new Set<string>();
              for (const loser of losers) {
                for (const t of loser.contact_tags ?? []) {
                  if (!winnerTagIds.has(t.tag_id)) newTagIds.add(t.tag_id);
                }
              }
              if (newTagIds.size > 0) {
                const tagRows = [...newTagIds].map((tag_id) => ({ contact_id: winner.id, tag_id }));
                await supabase.from('contact_tags').upsert(tagRows, { onConflict: 'contact_id,tag_id' });
              }

              // 3. Transfere demandas dos losers para o winner
              await supabase.from('demands').update({ contact_id: winner.id }).in('contact_id', loserIds);

              // 4. Apaga as ligações de tags dos losers (já estão no winner)
              await supabase.from('contact_tags').delete().in('contact_id', loserIds);

              // 5. Marca os losers como mesclados (soft-delete via merged_into)
              await supabase
                .from('contacts')
                .update({ merged_into: winner.id })
                .in('id', loserIds);

              result.autoResolved++;
            } catch {
              result.errors++;
            }
          })
        );
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-count'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-groups'] });
      const msg = `${result.autoResolved} grupos resolvidos automaticamente${result.conflictsRemaining > 0 ? `, ${result.conflictsRemaining} com conflito real para revisar` : ''}${result.errors > 0 ? ` (${result.errors} erros)` : ''}`;
      toast.success(msg);
      logActivity({
        type: 'merge',
        entity_type: 'contact',
        description: `Auto-mesclou ${result.autoResolved} grupos de duplicados (sem conflito)`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro no auto-merge: ${error.message}`);
    },
  });
}
