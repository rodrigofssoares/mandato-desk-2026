import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ContactFormData } from '@/lib/contactValidation';
import { logActivity } from '@/lib/activityLog';
import { phoneComparisonKey } from '@/lib/normalization';
import { triggerGoogleSync } from '@/lib/googleSync';
import { useAuth } from '@/context/AuthContext';
import {
  applyContactsClientFilters,
  applyContactsServerFilters,
  buildContactsSelectClause,
  hydrateContactTags,
} from '@/lib/contactsFilters';

// ---------- Phone duplicity check ----------

interface DuplicatePhoneMatch {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  matchedField: 'telefone' | 'whatsapp';
}

/**
 * Busca um contato existente cujo telefone/whatsapp tenha a mesma chave
 * normalizada de qualquer um dos números informados. Se `excludeId` for
 * passado, ignora esse contato na comparação (útil no update).
 */
async function findDuplicatePhoneContact(
  phones: { telefone?: string | null; whatsapp?: string | null },
  excludeId?: string
): Promise<DuplicatePhoneMatch | null> {
  const keys = new Set<string>();
  const tel = phoneComparisonKey(phones.telefone);
  const wa = phoneComparisonKey(phones.whatsapp);
  if (tel) keys.add(tel);
  if (wa) keys.add(wa);
  if (keys.size === 0) return null;

  // Busca somente contatos que tenham algum telefone preenchido
  let query = supabase
    .from('contacts')
    .select('id, nome, telefone, whatsapp')
    .is('merged_into', null)
    .or('telefone.not.is.null,whatsapp.not.is.null');
  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw error;

  for (const c of data ?? []) {
    const ck = phoneComparisonKey(c.telefone);
    const wk = phoneComparisonKey(c.whatsapp);
    if (ck && keys.has(ck)) {
      return { id: c.id, nome: c.nome, telefone: c.telefone, whatsapp: c.whatsapp, matchedField: 'telefone' };
    }
    if (wk && keys.has(wk)) {
      return { id: c.id, nome: c.nome, telefone: c.telefone, whatsapp: c.whatsapp, matchedField: 'whatsapp' };
    }
  }
  return null;
}

// ---------- Types ----------

/**
 * Valor de filtro para um campo personalizado. O tipo determina quais
 * campos são usados na query do Supabase (ver `useContacts`).
 */
export type CustomFieldFilterValue =
  | { tipo: 'texto'; contains: string }
  | { tipo: 'numero'; min?: number; max?: number }
  | { tipo: 'data'; from?: string; to?: string }
  | { tipo: 'booleano'; value: boolean }
  | { tipo: 'selecao'; values: string[] };

export interface ContactFilters {
  search?: string;
  tags?: string[];
  is_favorite?: boolean;
  declarou_voto?: boolean | null;
  birthday_filter?: 'today' | '7days' | '30days' | 'month' | null;
  /** Início do range de aniversário (formato MM-DD, ano ignorado) */
  birthday_from?: string;
  /** Fim do range de aniversário (formato MM-DD, ano ignorado) */
  birthday_to?: string;
  last_contact_filter?: 'today' | '7d' | '30d' | '30d+' | '60d+' | 'never' | null;
  /** Início do range de último contato (data YYYY-MM-DD) */
  last_contact_from?: string;
  /** Fim do range de último contato (data YYYY-MM-DD) */
  last_contact_to?: string;
  leader_id?: string;
  /** IDs de campos de campanha — contato precisa ter TODOS marcados */
  campaign_field_ids?: string[];
  /** Filtros por campos personalizados (chave = campo_id). Contato precisa satisfazer TODOS. */
  custom_fields?: Record<string, CustomFieldFilterValue>;
  date_from?: string;
  date_to?: string;
  sort_by?: 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc' | 'favorites_first' | 'ranking_desc';
  page?: number;
  per_page?: number;
  /** Filtro de cidade (ILIKE case-insensitive) */
  cidade?: string;
  /** Filtro de estado (match exato, ex: 'MG') */
  estado?: string;
  /** Filtro de origem (ILIKE + IS NOT NULL) */
  origem?: string;
  /** Filtro de bairro (ILIKE case-insensitive) */
  bairro?: string;
  /** Filtro de logradouro (ILIKE case-insensitive) */
  logradouro?: string;
  /** Filtro de complemento (ILIKE case-insensitive — NULLs nunca batem com ILIKE) */
  complemento?: string;
  /** Filtro de CEP (ILIKE case-insensitive — permite busca parcial) */
  cep?: string;
  /** Filtro de telefone: 'com' = IS NOT NULL, 'sem' = IS NULL */
  has_phone?: 'com' | 'sem';
  /** Filtro de e-mail: 'com' = IS NOT NULL, 'sem' = IS NULL */
  has_email?: 'com' | 'sem';
  /** Filtro de demanda registrada: 'com' = tem ao menos 1, 'sem' = não tem nenhuma */
  has_demand?: 'com' | 'sem';
  /** UUID do board (funil) — usa embed !inner para evitar URL limit */
  board_id?: string;
  /** UUID do stage (etapa) — só válido com board_id */
  stage_id?: string;
  /** Sem nenhum board_item em nenhum board — exclusivo com board_id */
  no_funnel?: boolean;
  /** Aceita WhatsApp (sim/não/todos) */
  aceita_whatsapp?: boolean | null;
  /** Está no canal de WhatsApp (sim/não/todos) */
  em_canal_whatsapp?: boolean | null;
  /** É multiplicador (sim/não/todos) */
  e_multiplicador?: boolean | null;
  /** Ranking mínimo (0-10) — inclusivo */
  ranking_min?: number;
  /** Ranking máximo (0-10) — inclusivo */
  ranking_max?: number;
}

export interface Contact {
  id: string;
  nome: string;
  nome_whatsapp?: string | null;
  whatsapp?: string | null;
  em_canal_whatsapp?: boolean;
  aceita_whatsapp?: boolean;
  e_multiplicador?: boolean;
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
  ranking_manual_override?: boolean;
  leader_id?: string | null;
  origem?: string | null;
  observacoes?: string | null;
  notas_assessor?: string | null;
  is_favorite?: boolean;
  ultimo_contato?: string | null;
  created_at: string;
  updated_at?: string;
  atualizado_por?: string | null;
  contact_tags?: { tag_id: string; tags: Tag }[];
}

export interface Tag {
  id: string;
  nome: string;
  cor?: string | null;
  group_id?: string | null;
  group_label?: string | null;
  group_slug?: string | null;
}

// ---------- useContacts ----------

export function useContacts(filters: ContactFilters = {}) {
  const { sort_by = 'created_desc', page = 1, per_page = 50 } = filters;

  return useQuery({
    queryKey: ['contacts', filters],
    queryFn: async () => {
      const from = (page - 1) * per_page;
      const to = from + per_page - 1;

      const { selectClause, usingTagFilter, usingBoardFilter } = buildContactsSelectClause(filters);

      let query = supabase.from('contacts').select(selectClause, { count: 'exact' });

      const applied = await applyContactsServerFilters(supabase, query, filters);
      if (applied.empty) {
        return { data: [], count: 0 };
      }
      query = applied.query;

      // Sorting
      switch (sort_by) {
        case 'name_asc':
          query = query.order('nome', { ascending: true });
          break;
        case 'name_desc':
          query = query.order('nome', { ascending: false });
          break;
        case 'created_asc':
          query = query.order('created_at', { ascending: true });
          break;
        case 'favorites_first':
          query = query.order('is_favorite', { ascending: false }).order('nome', { ascending: true });
          break;
        case 'ranking_desc':
          query = query.order('ranking', { ascending: false }).order('nome', { ascending: true });
          break;
        case 'created_desc':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Cast via unknown porque o select com !inner produz um tipo inferido
      // diferente de Contact[]; a forma é compatível.
      let filtered = (data as unknown) as Contact[];

      // Re-hidrata tags quando o select usou !inner (embed vem reduzido)
      if ((usingTagFilter || usingBoardFilter) && filtered.length > 0) {
        filtered = await hydrateContactTags(supabase, filtered);
      }

      filtered = applyContactsClientFilters(filtered, filters);

      return { data: filtered, count: count ?? filtered.length };
    },
  });
}

// ---------- useContact ----------

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ['contact', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, contact_tags(tag_id, tags(id, nome, cor))')
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data as Contact;
    },
  });
}

// ---------- useCreateContact ----------

export function useCreateContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (formData: ContactFormData) => {
      const { tag_ids, ...contactData } = formData;

      // Bloqueia antes do insert se já existe contato com o mesmo telefone/whatsapp
      // em qualquer formato (+55, 55, sem DDI — todos caem na mesma chave).
      const dup = await findDuplicatePhoneContact({
        telefone: contactData.telefone as string | undefined,
        whatsapp: contactData.whatsapp as string | undefined,
      });
      if (dup) {
        const numero = dup.matchedField === 'telefone' ? dup.telefone : dup.whatsapp;
        throw new Error(
          `Já existe um contato com esse telefone: "${dup.nome}" (${numero ?? '-'}).`
        );
      }

      // Limpa strings vazias para null
      const cleaned = Object.fromEntries(
        Object.entries(contactData).map(([k, v]) => [k, v === '' ? null : v])
      );

      // created_by precisa ser populado para que o sync ↔ Google Contacts encontre o contato
      // (a Edge Function filtra por .eq('created_by', user_id) como proteção IDOR).
      const payload = user?.id ? { ...cleaned, created_by: user.id } : cleaned;

      const { data, error } = await supabase
        .from('contacts')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Insere tags
      if (tag_ids && tag_ids.length > 0) {
        const tagRows = tag_ids.map((tag_id) => ({
          contact_id: data.id,
          tag_id,
        }));
        const { error: tagError } = await supabase.from('contact_tags').insert(tagRows);
        if (tagError) throw tagError;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-count'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-groups'] });
      toast.success('Contato criado com sucesso');
      logActivity({ type: 'create', entity_type: 'contact', entity_name: data.nome, entity_id: data.id, description: `Criou o contato "${data.nome}"` });

      // Disparo fire-and-forget para Google Contacts (D2)
      if (user?.id) {
        triggerGoogleSync('create', data.id, user.id, queryClient);
      }
    },
    onError: (error: Error) => {
      console.error('[useContacts] mutation error:', error);
      toast.error(`Erro ao criar contato: ${error.message}`);
    },
  });
}

// ---------- useUpdateContact ----------

export function useUpdateContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data: formData }: { id: string; data: ContactFormData }) => {
      const { tag_ids, ...contactData } = formData;

      // Só verifica duplicata de telefone quando o valor realmente mudou.
      // Evita bloquear updates de etiquetas em contatos com duplicata legacy.
      const { data: current, error: currentErr } = await supabase
        .from('contacts')
        .select('telefone, whatsapp')
        .eq('id', id)
        .single();
      if (currentErr) throw currentErr;

      const telKeyAtual = phoneComparisonKey(current?.telefone);
      const telKeyNovo  = phoneComparisonKey(contactData.telefone as string | undefined);
      const waKeyAtual  = phoneComparisonKey(current?.whatsapp);
      const waKeyNovo   = phoneComparisonKey(contactData.whatsapp as string | undefined);

      const telefoneMudou = telKeyAtual !== telKeyNovo;
      const whatsappMudou = waKeyAtual !== waKeyNovo;

      if (telefoneMudou || whatsappMudou) {
        const dup = await findDuplicatePhoneContact(
          {
            telefone: contactData.telefone as string | undefined,
            whatsapp: contactData.whatsapp as string | undefined,
          },
          id
        );
        if (dup) {
          const numero = dup.matchedField === 'telefone' ? dup.telefone : dup.whatsapp;
          throw new Error(
            `Outro contato já usa esse telefone: "${dup.nome}" (${numero ?? '-'}).`
          );
        }
      }

      const cleaned = Object.fromEntries(
        Object.entries(contactData).map(([k, v]) => [k, v === '' ? null : v])
      );

      const { data, error } = await supabase
        .from('contacts')
        .update(cleaned)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Sync tags em delta: só remove o que saiu e só adiciona o que entrou.
      // Evita erros silenciosos do delete sem retorno e reduz writes desnecessários.
      const { data: currentTagRows, error: currentTagsErr } = await supabase
        .from('contact_tags')
        .select('tag_id')
        .eq('contact_id', id);
      if (currentTagsErr) throw currentTagsErr;

      const currentIds = new Set((currentTagRows ?? []).map((r) => r.tag_id));
      const nextIds = new Set(tag_ids ?? []);
      const toRemove = [...currentIds].filter((t) => !nextIds.has(t));
      const toAdd = [...nextIds].filter((t) => !currentIds.has(t));

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from('contact_tags')
          .delete()
          .eq('contact_id', id)
          .in('tag_id', toRemove);
        if (delErr) throw delErr;
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map((tag_id) => ({ contact_id: id, tag_id }));
        const { error: insErr } = await supabase.from('contact_tags').insert(rows);
        if (insErr) throw insErr;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['board_items'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-count'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-groups'] });
      toast.success('Contato atualizado com sucesso');
      logActivity({ type: 'update', entity_type: 'contact', entity_id: variables.id, description: `Atualizou o contato` });

      // Disparo fire-and-forget para Google Contacts (D2)
      if (user?.id) {
        triggerGoogleSync('update', variables.id, user.id, queryClient);
      }
    },
    onError: (error: Error) => {
      console.error('[useContacts] mutation error:', error);
      toast.error(`Erro ao atualizar contato: ${error.message}`);
    },
  });
}

// ---------- useDeleteContact ----------

export function useDeleteContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      // Captura google_resource_name antes de deletar para uso no sync
      const { data: contactData } = await supabase
        .from('contacts')
        .select('google_resource_name')
        .eq('id', id)
        .maybeSingle();

      const googleResourceName = (contactData as { google_resource_name?: string | null } | null)?.google_resource_name ?? null;

      // Tags are deleted by cascade
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;

      return { contactId: id, googleResourceName };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-count'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-groups'] });
      toast.success('Contato excluído com sucesso');
      logActivity({ type: 'delete', entity_type: 'contact', description: 'Excluiu um contato' });

      // Disparo fire-and-forget para Google Contacts (D2/D7)
      if (user?.id) {
        // FIX P-CRIT-2: google_resource_name não é mais enviado — Edge Function busca do banco
        triggerGoogleSync('delete', result.contactId, user.id, queryClient);
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir contato: ${error.message}`);
    },
  });
}

// ---------- useToggleFavorite ----------

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ is_favorite })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// ---------- useContactTags ----------

export function useContactTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, nome, cor, group_id, tag_group:tag_groups(slug, label)')
        .order('nome', { ascending: true });

      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        cor: t.cor,
        group_id: t.group_id,
        group_slug: t.tag_group?.slug ?? null,
        group_label: t.tag_group?.label ?? null,
      })) as Tag[];
    },
  });
}

// ---------- useLeaders (for filter dropdown) ----------

export function useLeaders() {
  return useQuery({
    queryKey: ['leaders-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });
}
