import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';
import { phoneComparisonKey } from '@/lib/normalization';
import type { DuplicateAnalysis } from '@/lib/duplicate-analysis';

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

// ---------- Resolucao SOFT (regras suaves) ----------

function readField(c: DuplicateContact, key: string): unknown {
  return (c as unknown as Record<string, unknown>)[key];
}

function pickLongest(group: DuplicateContact[], winner: DuplicateContact, key: string): string | null {
  let best = String(readField(winner, key) ?? '');
  for (const c of group) {
    const v = String(readField(c, key) ?? '');
    if (v && v.length > best.length) best = v;
  }
  return best || null;
}

function pickMostRecent(group: DuplicateContact[], winner: DuplicateContact, key: string): unknown {
  let bestVal = readField(winner, key);
  let bestTime = new Date(winner.updated_at ?? winner.created_at).getTime();
  for (const c of group) {
    if (c.id === winner.id) continue;
    const v = readField(c, key);
    if (v === null || v === undefined || v === '') continue;
    const t = new Date(c.updated_at ?? c.created_at).getTime();
    if (bestVal === null || bestVal === undefined || bestVal === '' || t > bestTime) {
      bestVal = v;
      bestTime = t;
    }
  }
  return bestVal === '' ? null : bestVal;
}

function concatenateUnique(group: DuplicateContact[], key: string): string | null {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const c of group) {
    const v = String(readField(c, key) ?? '').trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      parts.push(v);
    }
  }
  return parts.length === 0 ? null : parts.join('\n---\n');
}

function orBoolean(group: DuplicateContact[], key: string): boolean {
  return group.some((c) => Boolean(readField(c, key)));
}

function maxNumber(group: DuplicateContact[], key: string): number | null {
  let max: number | null = null;
  for (const c of group) {
    const v = readField(c, key);
    if (typeof v === 'number' && (max === null || v > max)) max = v;
  }
  return max;
}

function pickFirstNonEmpty(group: DuplicateContact[], key: string): unknown {
  for (const c of group) {
    const v = readField(c, key);
    if (v !== null && v !== undefined && v !== '') return v;
  }
  return null;
}

/**
 * Resolve um grupo com regras suaves: divergencias sao consolidadas com regras
 * por tipo de campo. Pre-condicao: nao ha conflito hard (CPF / data_nascimento /
 * genero). Devolve apenas os campos que mudaram em relacao ao winner.
 */
function resolveSoftConflicts(
  group: DuplicateContact[],
  winner: DuplicateContact
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const wRec = winner as unknown as Record<string, unknown>;

  // Texto: pegar mais longo
  for (const k of ['nome', 'nome_whatsapp']) {
    const v = pickLongest(group, winner, k);
    if (v && v !== wRec[k]) merged[k] = v;
  }

  // Mais recente: email + redes sociais
  for (const k of ['email', 'instagram', 'twitter', 'tiktok', 'youtube']) {
    const v = pickMostRecent(group, winner, k);
    if (v !== wRec[k] && v !== null && v !== undefined && v !== '') merged[k] = v;
  }

  // Endereco: unitario (nao Frankenstein). Se winner tem qualquer campo de
  // endereco, mantem o dele. Senao, copia em bloco do primeiro contato com
  // logradouro preenchido.
  const addressFields = ['logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep'];
  const winnerHasAddress = addressFields.some(
    (f) => wRec[f] !== null && wRec[f] !== undefined && wRec[f] !== ''
  );
  if (!winnerHasAddress) {
    const candidate = group
      .filter((c) => c.id !== winner.id)
      .find((c) => readField(c, 'logradouro') || readField(c, 'cep') || readField(c, 'bairro'));
    if (candidate) {
      const cRec = candidate as unknown as Record<string, unknown>;
      for (const f of addressFields) {
        if (cRec[f]) merged[f] = cRec[f];
      }
    }
  }

  // Concatenacao: observacoes + notas
  for (const k of ['observacoes', 'notas_assessor']) {
    const v = concatenateUnique(group, k);
    if (v && v !== wRec[k]) merged[k] = v;
  }

  // Booleanos: OR (qualquer true vence)
  for (const k of ['is_favorite', 'aceita_whatsapp', 'em_canal_whatsapp', 'declarou_voto', 'e_multiplicador']) {
    if (group.some((c) => readField(c, k) !== undefined)) {
      const v = orBoolean(group, k);
      if (v !== Boolean(wRec[k])) merged[k] = v;
    }
  }

  // Numero: MAX (ranking)
  const ranking = maxNumber(group, 'ranking');
  if (ranking !== null && ranking !== wRec.ranking) merged.ranking = ranking;

  // Primeiro nao-vazio: campos onde nao faz sentido somar/concatenar
  for (const k of ['origem', 'leader_id', 'genero', 'data_nascimento', 'cpf', 'profissao']) {
    if (!wRec[k]) {
      const v = pickFirstNonEmpty(group, k);
      if (v) merged[k] = v;
    }
  }

  // ultimo_contato: mais recente
  let bestLast: string | null = winner.ultimo_contato ?? null;
  for (const c of group) {
    if (c.ultimo_contato && (!bestLast || c.ultimo_contato > bestLast)) bestLast = c.ultimo_contato;
  }
  if (bestLast && bestLast !== wRec.ultimo_contato) merged.ultimo_contato = bestLast;

  return merged;
}

// ---------- useAutoResolveDuplicates (massa: auto + dismiss) ----------

export interface AutoResolveResult {
  mergedGroups: number;
  mergedContacts: number;
  dismissedGroups: number;
  manualRemaining: number;
  errors: number;
  errorMessages: string[];
}

interface AutoResolveOptions {
  onProgress?: (done: number, total: number, label: string) => void;
}

export function useAutoResolveDuplicates(opts: AutoResolveOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysis: DuplicateAnalysis): Promise<AutoResolveResult> => {
      const result: AutoResolveResult = {
        mergedGroups: 0,
        mergedContacts: 0,
        dismissedGroups: 0,
        manualRemaining: analysis.byCategory.MANUAL.groups,
        errors: 0,
        errorMessages: [],
      };

      const autoGroups = analysis.groups.filter(
        (ag) => ag.category === 'AUTO_HARD' || ag.category === 'AUTO_SOFT'
      );
      const dismissGroups = analysis.groups.filter((ag) => ag.category === 'DISMISS_NAME');

      const total = autoGroups.length + dismissGroups.length;
      let done = 0;
      const tick = (label: string) => {
        done++;
        opts.onProgress?.(done, total, label);
      };

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;

      // 1. Auto-merge em lotes paralelos
      const BATCH = 5;
      for (let i = 0; i < autoGroups.length; i += BATCH) {
        const slice = autoGroups.slice(i, i + BATCH);
        await Promise.all(
          slice.map(async (ag) => {
            try {
              const winner = pickWinner(ag.group.contacts);
              const losers = ag.group.contacts.filter((c) => c.id !== winner.id);
              const loserIds = losers.map((l) => l.id);

              // AUTO_HARD: so preenche campos vazios. AUTO_SOFT: aplica regras.
              const mergedFields =
                ag.category === 'AUTO_HARD'
                  ? computeMergedFields(ag.group.contacts, winner)
                  : resolveSoftConflicts(ag.group.contacts, winner);

              if (Object.keys(mergedFields).length > 0) {
                const { error } = await supabase
                  .from('contacts')
                  .update({ ...mergedFields, updated_at: new Date().toISOString() })
                  .eq('id', winner.id);
                if (error) throw error;
              }

              // Uniao de tags
              const winnerTagIds = new Set((winner.contact_tags ?? []).map((t) => t.tag_id));
              const newTagIds = new Set<string>();
              for (const loser of losers) {
                for (const t of loser.contact_tags ?? []) {
                  if (!winnerTagIds.has(t.tag_id)) newTagIds.add(t.tag_id);
                }
              }
              if (newTagIds.size > 0) {
                const tagRows = [...newTagIds].map((tag_id) => ({ contact_id: winner.id, tag_id }));
                await supabase
                  .from('contact_tags')
                  .upsert(tagRows, { onConflict: 'contact_id,tag_id' });
              }

              if (loserIds.length > 0) {
                // Transfere demandas
                await supabase.from('demands').update({ contact_id: winner.id }).in('contact_id', loserIds);
                // Limpa tags antigas dos losers
                await supabase.from('contact_tags').delete().in('contact_id', loserIds);

                // Log em contact_merges (um por loser)
                const mergeRows = losers.map((l) => ({
                  kept_contact_id: winner.id,
                  deleted_contact_id: l.id,
                  deleted_contact_snapshot: l as unknown,
                  merged_fields: mergedFields,
                  merged_by: userId,
                }));
                await supabase.from('contact_merges').insert(mergeRows);

                // Soft-delete dos losers
                await supabase.from('contacts').update({ merged_into: winner.id }).in('id', loserIds);
              }

              result.mergedGroups++;
              result.mergedContacts += losers.length;
            } catch (e: unknown) {
              result.errors++;
              const msg = e instanceof Error ? e.message : String(e);
              result.errorMessages.push(`${ag.group.match_value}: ${msg}`);
            }
            tick(`Mesclando grupo ${ag.group.match_field}`);
          })
        );
      }

      // 2. Dismiss em massa em chunks
      if (dismissGroups.length > 0) {
        const CHUNK = 500;
        for (let i = 0; i < dismissGroups.length; i += CHUNK) {
          const slice = dismissGroups.slice(i, i + CHUNK);
          const rows = slice.map((ag) => ({
            match_field: ag.group.match_field,
            match_value: ag.group.match_value,
            reason: ag.reason,
            dismissed_by: userId,
          }));
          const { error } = await supabase
            .from('dismissed_duplicate_groups')
            .upsert(rows, { onConflict: 'match_field,match_value', ignoreDuplicates: true });
          if (error) {
            result.errors++;
            result.errorMessages.push(`dismiss chunk ${i}: ${error.message}`);
          } else {
            result.dismissedGroups += slice.length;
          }
          slice.forEach(() => tick('Ocultando falsos positivos'));
        }
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-count'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-groups'] });
      const parts: string[] = [];
      if (result.mergedContacts > 0) parts.push(`${result.mergedContacts} contatos mesclados`);
      if (result.dismissedGroups > 0) parts.push(`${result.dismissedGroups} grupos ocultos`);
      if (result.manualRemaining > 0) parts.push(`${result.manualRemaining} para revisar`);
      if (result.errors > 0) parts.push(`${result.errors} erros`);
      toast.success(`Resolucao automatica: ${parts.join(' · ')}`);
      logActivity({
        type: 'merge',
        entity_type: 'contact',
        description: `Auto-resolveu ${result.mergedGroups} grupos (${result.mergedContacts} contatos) e ocultou ${result.dismissedGroups} falsos positivos`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro na resolucao automatica: ${error.message}`);
    },
  });
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
