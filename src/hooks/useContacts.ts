import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ContactFormData } from '@/lib/contactValidation';
import { logActivity } from '@/lib/activityLog';

// ---------- Types ----------

export interface ContactFilters {
  search?: string;
  tags?: string[];
  is_favorite?: boolean;
  declarou_voto?: boolean | null;
  birthday_filter?: 'today' | '7days' | '30days' | 'month' | null;
  last_contact_filter?: 'today' | '7d' | '30d' | '30d+' | '60d+' | 'never' | null;
  leader_id?: string;
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
  categoria?: string | null;
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

      let query = supabase
        .from('contacts')
        .select('*, contact_tags(tag_id, tags(id, nome, cor, categoria))', { count: 'exact' });

      // Search
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`nome.ilike.${term},email.ilike.${term},whatsapp.ilike.${term}`);
      }

      // Tags filter — contacts that have ALL specified tags
      if (tags && tags.length > 0) {
        // Busca IDs de contatos com as tags selecionadas
        const { data: taggedIds } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', tags);

        if (taggedIds && taggedIds.length > 0) {
          const uniqueIds = [...new Set(taggedIds.map((t) => t.contact_id))];
          query = query.in('id', uniqueIds);
        } else {
          return { data: [], count: 0 };
        }
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

      // Client-side birthday filtering for 7days/30days/month
      let filtered = data as Contact[];
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
        .select('*, contact_tags(tag_id, tags(id, nome, cor, categoria))')
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
        .select('id, nome, cor, categoria')
        .order('categoria', { ascending: true })
        .order('nome', { ascending: true });

      if (error) throw error;
      return data as Tag[];
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
