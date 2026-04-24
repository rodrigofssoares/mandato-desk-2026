import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ContactFormData } from '@/lib/contactValidation';
import { logActivity } from '@/lib/activityLog';
import { phoneComparisonKey } from '@/lib/normalization';

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
  last_contact_filter?: 'today' | '7d' | '30d' | '30d+' | '60d+' | 'never' | null;
  leader_id?: string;
  /** IDs de campos de campanha — contato precisa ter TODOS marcados */
  campaign_field_ids?: string[];
  /** Filtros por campos personalizados (chave = campo_id). Contato precisa satisfazer TODOS. */
  custom_fields?: Record<string, CustomFieldFilterValue>;
  date_from?: string;
  date_to?: string;
  sort_by?: 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc' | 'favorites_first';
  page?: number;
  per_page?: number;
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
  const {
    search,
    tags,
    is_favorite,
    declarou_voto,
    birthday_filter,
    last_contact_filter,
    leader_id,
    campaign_field_ids,
    custom_fields,
    date_from,
    date_to,
    sort_by = 'created_desc',
    page = 1,
    per_page = 50,
  } = filters;

  return useQuery({
    queryKey: ['contacts', filters],
    queryFn: async () => {
      const from = (page - 1) * per_page;
      const to = from + per_page - 1;

      // Tags filter (OR): contato tem QUALQUER uma das etiquetas selecionadas.
      // Usa embed !inner para empurrar o filtro pro server-side. Isso evita
      // o bug anterior: listar centenas de contact_ids em .in('id', [...])
      // estourava a URL (>16KB) e o PostgREST retornava 400, fazendo
      // "sumirem" todos os contatos da tela.
      const usingTagFilter = tags && tags.length > 0;
      const selectClause = usingTagFilter
        ? '*, contact_tags!inner(tag_id)'
        : '*, contact_tags(tag_id, tags(id, nome, cor))';

      let query = supabase
        .from('contacts')
        .select(selectClause, { count: 'exact' });

      if (usingTagFilter) {
        query = query.in('contact_tags.tag_id', tags as string[]);
      }

      // Search
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`nome.ilike.${term},email.ilike.${term},whatsapp.ilike.${term}`);
      }

      // Favorite
      if (is_favorite === true) {
        query = query.eq('is_favorite', true);
      }

      // Declarou voto
      if (declarou_voto === true) {
        query = query.eq('declarou_voto', true);
      } else if (declarou_voto === false) {
        query = query.eq('declarou_voto', false);
      }

      // Birthday
      if (birthday_filter) {
        if (birthday_filter === 'today') {
          const now = new Date();
          const month = now.getMonth() + 1;
          const day = now.getDate();
          const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          query = query.ilike('data_nascimento', `%-${mmdd}`);
        } else {
          query = query.not('data_nascimento', 'is', null);
        }
      }

      // Último contato
      if (last_contact_filter) {
        const now = new Date();
        if (last_contact_filter === 'never') {
          query = query.is('ultimo_contato', null);
        } else if (last_contact_filter === 'today') {
          const today = now.toISOString().split('T')[0];
          query = query.gte('ultimo_contato', today);
        } else if (last_contact_filter === '7d') {
          const d = new Date(now);
          d.setDate(d.getDate() - 7);
          query = query.gte('ultimo_contato', d.toISOString());
        } else if (last_contact_filter === '30d') {
          const d = new Date(now);
          d.setDate(d.getDate() - 30);
          query = query.gte('ultimo_contato', d.toISOString());
        } else if (last_contact_filter === '30d+') {
          const d = new Date(now);
          d.setDate(d.getDate() - 30);
          query = query.lt('ultimo_contato', d.toISOString());
        } else if (last_contact_filter === '60d+') {
          const d = new Date(now);
          d.setDate(d.getDate() - 60);
          query = query.lt('ultimo_contato', d.toISOString());
        }
      }

      // Leader
      if (leader_id) {
        query = query.eq('leader_id', leader_id);
      }

      // Campos de campanha — contato precisa ter TODOS marcados como true
      if (campaign_field_ids && campaign_field_ids.length > 0) {
        const { data: ccvRows } = await supabase
          .from('contact_campaign_values')
          .select('contact_id, campaign_field_id')
          .eq('valor', true)
          .in('campaign_field_id', campaign_field_ids);

        if (!ccvRows || ccvRows.length === 0) {
          return { data: [], count: 0 };
        }

        // Agrupa por contact_id e conta quantos campos distintos cada contato tem
        const countsByContact = new Map<string, Set<string>>();
        ccvRows.forEach((r) => {
          const set = countsByContact.get(r.contact_id) ?? new Set<string>();
          set.add(r.campaign_field_id);
          countsByContact.set(r.contact_id, set);
        });

        const matchingIds = [...countsByContact.entries()]
          .filter(([, set]) => set.size === campaign_field_ids.length)
          .map(([id]) => id);

        if (matchingIds.length === 0) {
          return { data: [], count: 0 };
        }
        query = query.in('id', matchingIds);
      }

      // Campos personalizados — interseção de contact_ids por filtro
      if (custom_fields && Object.keys(custom_fields).length > 0) {
        // Para cada entrada, resolve quais contact_ids atendem o critério
        const entries = Object.entries(custom_fields);
        const idSets: Array<Set<string>> = [];

        for (const [campoId, filtro] of entries) {
          // Ignora filtros vazios (sem termo preenchido)
          if (!filtro) continue;
          if (filtro.tipo === 'texto' && !filtro.contains?.trim()) continue;
          if (filtro.tipo === 'numero' && filtro.min === undefined && filtro.max === undefined) continue;
          if (filtro.tipo === 'data' && !filtro.from && !filtro.to) continue;
          if (filtro.tipo === 'selecao' && (!filtro.values || filtro.values.length === 0)) continue;

          let cpv = supabase
            .from('campos_personalizados_valores')
            .select('contact_id')
            .eq('campo_id', campoId);

          if (filtro.tipo === 'texto') {
            cpv = cpv.ilike('valor_texto', `%${filtro.contains.trim()}%`);
          } else if (filtro.tipo === 'numero') {
            if (filtro.min !== undefined) cpv = cpv.gte('valor_numero', filtro.min);
            if (filtro.max !== undefined) cpv = cpv.lte('valor_numero', filtro.max);
          } else if (filtro.tipo === 'data') {
            if (filtro.from) cpv = cpv.gte('valor_data', filtro.from);
            if (filtro.to) cpv = cpv.lte('valor_data', filtro.to);
          } else if (filtro.tipo === 'booleano') {
            cpv = cpv.eq('valor_bool', filtro.value);
          } else if (filtro.tipo === 'selecao') {
            cpv = cpv.in('valor_selecao', filtro.values);
          }

          const { data: rows, error: cpvError } = await cpv;
          if (cpvError) throw cpvError;

          const ids = new Set<string>((rows ?? []).map((r) => r.contact_id));
          if (ids.size === 0) {
            return { data: [], count: 0 };
          }
          idSets.push(ids);
        }

        if (idSets.length > 0) {
          // Interseção de todos os conjuntos
          const intersection = idSets.reduce((acc, set) => {
            return new Set([...acc].filter((id) => set.has(id)));
          });
          if (intersection.size === 0) {
            return { data: [], count: 0 };
          }
          query = query.in('id', [...intersection]);
        }
      }

      // Date range
      if (date_from) {
        query = query.gte('created_at', date_from);
      }
      if (date_to) {
        query = query.lte('created_at', `${date_to}T23:59:59`);
      }

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
        case 'created_desc':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      // Pagination
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Quando usamos !inner para o filtro de tags, o embed vem reduzido
      // (so as tags que bateram no filtro, sem nome/cor). Hidratamos a lista
      // completa das tags de cada contato exibido numa segunda query pequena
      // (no maximo per_page UUIDs, URL minuscula).
      let filtered = data as Contact[];
      if (usingTagFilter && filtered.length > 0) {
        const contactIds = filtered.map((c) => c.id);
        const { data: tagRows, error: tagError } = await supabase
          .from('contact_tags')
          .select('contact_id, tag_id, tags(id, nome, cor)')
          .in('contact_id', contactIds);
        if (tagError) throw tagError;

        const byContact = new Map<string, { tag_id: string; tags: Tag }[]>();
        (tagRows ?? []).forEach((r: any) => {
          const arr = byContact.get(r.contact_id) ?? [];
          arr.push({ tag_id: r.tag_id, tags: r.tags });
          byContact.set(r.contact_id, arr);
        });

        filtered = filtered.map((c) => ({
          ...c,
          contact_tags: byContact.get(c.id) ?? [],
        }));
      }

      if (birthday_filter && birthday_filter !== 'today') {
        const now = new Date();
        const month = now.getMonth();
        const day = now.getDate();

        filtered = filtered.filter((c) => {
          if (!c.data_nascimento) return false;
          const bDate = new Date(c.data_nascimento + 'T00:00:00');
          const bMonth = bDate.getMonth();
          const bDay = bDate.getDate();

          if (birthday_filter === 'month') {
            return bMonth === month;
          }

          // Calculate days until birthday this year
          const thisYearBday = new Date(now.getFullYear(), bMonth, bDay);
          if (thisYearBday < now) {
            thisYearBday.setFullYear(thisYearBday.getFullYear() + 1);
          }
          const diffDays = Math.ceil((thisYearBday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (birthday_filter === '7days') return diffDays <= 7;
          if (birthday_filter === '30days') return diffDays <= 30;
          return true;
        });
      }

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

      const { data, error } = await supabase
        .from('contacts')
        .insert(cleaned)
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
      toast.success('Contato criado com sucesso');
      logActivity({ type: 'create', entity_type: 'contact', entity_name: data.nome, entity_id: data.id, description: `Criou o contato "${data.nome}"` });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar contato: ${error.message}`);
    },
  });
}

// ---------- useUpdateContact ----------

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data: formData }: { id: string; data: ContactFormData }) => {
      const { tag_ids, ...contactData } = formData;

      // Bloqueia se outro contato já usa esse telefone em qualquer formato.
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

      // Sync tags: remove all then re-insert
      await supabase.from('contact_tags').delete().eq('contact_id', id);

      if (tag_ids && tag_ids.length > 0) {
        const tagRows = tag_ids.map((tag_id) => ({
          contact_id: id,
          tag_id,
        }));
        const { error: tagError } = await supabase.from('contact_tags').insert(tagRows);
        if (tagError) throw tagError;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['board_items'] });
      toast.success('Contato atualizado com sucesso');
      logActivity({ type: 'update', entity_type: 'contact', entity_id: variables.id, description: `Atualizou o contato` });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar contato: ${error.message}`);
    },
  });
}

// ---------- useDeleteContact ----------

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Tags are deleted by cascade
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato excluído com sucesso');
      logActivity({ type: 'delete', entity_type: 'contact', description: 'Excluiu um contato' });
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
