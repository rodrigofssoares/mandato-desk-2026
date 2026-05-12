/**
 * Lógica compartilhada de filtragem de contatos.
 *
 * Razão de existir: a listagem (useContacts) e a exportação (ExportMenu)
 * precisam aplicar EXATAMENTE os mesmos filtros. Antes esse código vivia
 * duplicado em dois lugares e saiu de sincronia — filtros novos (bairro,
 * logradouro, CEP, complemento, has_phone, has_email, has_demand, board,
 * campos personalizados, etc.) caíram só no useContacts e o export ficou
 * exportando "tudo" mesmo quando o usuário tinha filtros ativos.
 *
 * Toda nova condição de filtro DEVE ser adicionada aqui, não em cópias
 * locais.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactFilters, Contact } from '@/hooks/useContacts';

// Escapa metacaracteres ILIKE (%, _) no texto buscado pelo usuário.
// Sem isso, "%" digitado vira wildcard e "_" casa qualquer caractere — o
// que confunde o usuário e amplia indevidamente o resultado.
function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Decide o select clause (com !inner quando necessário) baseado nos filtros.
 *
 * !inner empurra o filtro de tags/board pro server-side evitando .in('id',[...])
 * com centenas de IDs que estouraria o limite de URL do PostgREST (>16KB → 400).
 */
export function buildContactsSelectClause(filters: ContactFilters): {
  selectClause: string;
  usingTagFilter: boolean;
  usingBoardFilter: boolean;
} {
  const usingTagFilter = !!(filters.tags && filters.tags.length > 0);
  const usingBoardFilter = !!filters.board_id;

  let selectClause: string;
  if (usingTagFilter && usingBoardFilter) {
    selectClause = '*, contact_tags!inner(tag_id), board_items!inner(board_id, stage_id)';
  } else if (usingTagFilter) {
    selectClause = '*, contact_tags!inner(tag_id)';
  } else if (usingBoardFilter) {
    selectClause = '*, contact_tags(tag_id, tags(id, nome, cor)), board_items!inner(board_id, stage_id)';
  } else {
    selectClause = '*, contact_tags(tag_id, tags(id, nome, cor))';
  }

  return { selectClause, usingTagFilter, usingBoardFilter };
}

/**
 * Aplica todos os filtros server-side suportados ao query já encadeado.
 *
 * Retorna `{ query, empty }`. Se `empty` for `true`, o chamador deve devolver
 * lista vazia SEM executar a query principal (poupando uma round-trip ao banco)
 * — isso acontece quando algum sub-filtro (campos de campanha, custom_fields,
 * has_demand='com', etc.) resolveu pra zero resultados upstream.
 *
 * Filtros que dependem de cálculo client-side (birthday range com cruzamento
 * de ano) NÃO são aplicados aqui — use `applyContactsClientFilters` no array
 * de resultados.
 */
export async function applyContactsServerFilters<T>(
  supabase: SupabaseClient,
  baseQuery: T,
  filters: ContactFilters
): Promise<{ query: T; empty: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = baseQuery;

  const {
    search,
    tags,
    is_favorite,
    declarou_voto,
    birthday_filter,
    birthday_from,
    birthday_to,
    last_contact_filter,
    last_contact_from,
    last_contact_to,
    leader_id,
    campaign_field_ids,
    custom_fields,
    date_from,
    date_to,
    cidade,
    estado,
    origem,
    bairro,
    logradouro,
    complemento,
    cep,
    has_phone,
    has_email,
    has_demand,
    board_id,
    stage_id,
    no_funnel,
    aceita_whatsapp,
    em_canal_whatsapp,
    e_multiplicador,
    ranking_min,
    ranking_max,
  } = filters;

  const usingTagFilter = !!(tags && tags.length > 0);
  const usingBoardFilter = !!board_id;

  // Tags (!inner já configurado no select)
  if (usingTagFilter) {
    query = query.in('contact_tags.tag_id', tags as string[]);
  }

  // Funil
  if (usingBoardFilter) {
    query = query.eq('board_items.board_id', board_id as string);
    if (stage_id) {
      query = query.eq('board_items.stage_id', stage_id);
    }
  }

  // Search
  if (search && search.trim()) {
    const term = `%${escapeLike(search.trim())}%`;
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

  // Aceita WhatsApp
  if (aceita_whatsapp === true) {
    query = query.eq('aceita_whatsapp', true);
  } else if (aceita_whatsapp === false) {
    query = query.eq('aceita_whatsapp', false);
  }

  // Canal de WhatsApp
  if (em_canal_whatsapp === true) {
    query = query.eq('em_canal_whatsapp', true);
  } else if (em_canal_whatsapp === false) {
    query = query.eq('em_canal_whatsapp', false);
  }

  // Multiplicador
  if (e_multiplicador === true) {
    query = query.eq('e_multiplicador', true);
  } else if (e_multiplicador === false) {
    query = query.eq('e_multiplicador', false);
  }

  // Ranking range (0-10, inclusivo)
  if (typeof ranking_min === 'number') {
    query = query.gte('ranking', ranking_min);
  }
  if (typeof ranking_max === 'number') {
    query = query.lte('ranking', ranking_max);
  }

  // Birthday — pré-filtragem server-side: 'today' usa ILIKE exato no MM-DD;
  // outros valores apenas garantem NOT NULL e o cálculo fino fica no client.
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

  // Birthday range (MM-DD): também exige NOT NULL — fino é client-side
  if (birthday_from || birthday_to) {
    query = query.not('data_nascimento', 'is', null);
  }

  // Último contato (preset)
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

  // Último contato — range customizado (AND com o preset)
  if (last_contact_from) {
    query = query.gte('ultimo_contato', last_contact_from);
  }
  if (last_contact_to) {
    const end = new Date(`${last_contact_to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    query = query.lt('ultimo_contato', end.toISOString());
  }

  // Leader
  if (leader_id) {
    query = query.eq('leader_id', leader_id);
  }

  // Campos de campanha — contato precisa ter TODOS marcados como true
  if (campaign_field_ids && campaign_field_ids.length > 0) {
    const { data: ccvRows, error: ccvError } = await supabase
      .from('contact_campaign_values')
      .select('contact_id, campaign_field_id')
      .eq('valor', true)
      .in('campaign_field_id', campaign_field_ids);
    if (ccvError) throw ccvError;

    if (!ccvRows || ccvRows.length === 0) {
      return { query, empty: true };
    }

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
      return { query, empty: true };
    }
    query = query.in('id', matchingIds);
  }

  // Campos personalizados — interseção de contact_ids por filtro
  if (custom_fields && Object.keys(custom_fields).length > 0) {
    const entries = Object.entries(custom_fields);
    const idSets: Array<Set<string>> = [];

    for (const [campoId, filtro] of entries) {
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
        cpv = cpv.ilike('valor_texto', `%${escapeLike(filtro.contains.trim())}%`);
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
        return { query, empty: true };
      }
      idSets.push(ids);
    }

    if (idSets.length > 0) {
      const intersection = idSets.reduce((acc, set) => {
        return new Set([...acc].filter((id) => set.has(id)));
      });
      if (intersection.size === 0) {
        return { query, empty: true };
      }
      query = query.in('id', [...intersection]);
    }
  }

  // Cidade (ILIKE)
  if (cidade && cidade.trim()) {
    query = query.ilike('cidade', `%${escapeLike(cidade.trim())}%`);
  }

  // Estado (match exato)
  if (estado) {
    query = query.eq('estado', estado);
  }

  // Origem (ILIKE + NOT NULL)
  if (origem && origem.trim()) {
    query = query
      .not('origem', 'is', null)
      .ilike('origem', `%${escapeLike(origem.trim())}%`);
  }

  // Bairro (ILIKE)
  if (bairro && bairro.trim()) {
    query = query.ilike('bairro', `%${escapeLike(bairro.trim())}%`);
  }

  // Logradouro (ILIKE)
  if (logradouro && logradouro.trim()) {
    query = query.ilike('logradouro', `%${escapeLike(logradouro.trim())}%`);
  }

  // Complemento (ILIKE — NULLs não batem)
  if (complemento && complemento.trim()) {
    query = query.ilike('complemento', `%${escapeLike(complemento.trim())}%`);
  }

  // CEP (ILIKE — permite busca parcial)
  if (cep && cep.trim()) {
    query = query.ilike('cep', `%${escapeLike(cep.trim())}%`);
  }

  // Telefone / E-mail (IS NOT NULL / IS NULL)
  if (has_phone === 'com') {
    query = query.not('telefone', 'is', null);
  } else if (has_phone === 'sem') {
    query = query.is('telefone', null);
  }

  if (has_email === 'com') {
    query = query.not('email', 'is', null);
  } else if (has_email === 'sem') {
    query = query.is('email', null);
  }

  // Fora de qualquer funil — sub-query client-side em board_items
  if (no_funnel) {
    const { data: boardItemRows, error: boardItemError } = await supabase
      .from('board_items')
      .select('contact_id')
      .not('contact_id', 'is', null);
    if (boardItemError) throw boardItemError;

    const idsNoFunnel = [...new Set(
      (boardItemRows ?? []).map((r: { contact_id: string | null }) => r.contact_id).filter(Boolean)
    )] as string[];

    if (idsNoFunnel.length > 0) {
      query = query.not('id', 'in', `(${idsNoFunnel.join(',')})`);
    }
  }

  // Demanda registrada — sub-query client-side em demands
  if (has_demand) {
    const { data: demandRows, error: demandError } = await supabase
      .from('demands')
      .select('contact_id')
      .not('contact_id', 'is', null);
    if (demandError) throw demandError;

    const idsComDemanda = [...new Set(
      (demandRows ?? []).map((r: { contact_id: string | null }) => r.contact_id).filter(Boolean)
    )] as string[];

    if (has_demand === 'com') {
      if (idsComDemanda.length === 0) {
        return { query, empty: true };
      }
      query = query.in('id', idsComDemanda);
    } else {
      if (idsComDemanda.length > 0) {
        query = query.not('id', 'in', `(${idsComDemanda.join(',')})`);
      }
    }
  }

  // Date range (created_at)
  if (date_from) {
    query = query.gte('created_at', date_from);
  }
  if (date_to) {
    query = query.lte('created_at', `${date_to}T23:59:59`);
  }

  return { query: query as T, empty: false };
}

/**
 * Aplica filtros que precisam de cálculo client-side (birthday fino e range
 * de MM-DD que pode cruzar dezembro→janeiro). Operação pura sobre o array.
 */
export function applyContactsClientFilters(
  rows: Contact[],
  filters: ContactFilters
): Contact[] {
  let out = rows;
  const { birthday_filter, birthday_from, birthday_to } = filters;

  if (birthday_filter && birthday_filter !== 'today') {
    const now = new Date();
    const month = now.getMonth();

    out = out.filter((c) => {
      if (!c.data_nascimento) return false;
      const bDate = new Date(c.data_nascimento + 'T00:00:00');
      const bMonth = bDate.getMonth();
      const bDay = bDate.getDate();

      if (birthday_filter === 'month') {
        return bMonth === month;
      }

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

  if (birthday_from || birthday_to) {
    const toOrdinal = (mmdd: string): number | null => {
      const m = mmdd.match(/^(\d{2})-(\d{2})$/);
      if (!m) return null;
      const mm = Number(m[1]);
      const dd = Number(m[2]);
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
      return mm * 100 + dd;
    };
    const fromOrd = birthday_from ? toOrdinal(birthday_from) : null;
    const toOrd = birthday_to ? toOrdinal(birthday_to) : null;

    out = out.filter((c) => {
      if (!c.data_nascimento) return false;
      const bDate = new Date(c.data_nascimento + 'T00:00:00');
      const bOrd = (bDate.getMonth() + 1) * 100 + bDate.getDate();

      if (fromOrd != null && toOrd != null) {
        if (fromOrd <= toOrd) return bOrd >= fromOrd && bOrd <= toOrd;
        return bOrd >= fromOrd || bOrd <= toOrd;
      }
      if (fromOrd != null) return bOrd >= fromOrd;
      if (toOrd != null) return bOrd <= toOrd;
      return true;
    });
  }

  return out;
}

/**
 * Re-hidrata `contact_tags` com nome/cor quando o select usou !inner (que
 * reduz o embed só ao tag_id que casou no filtro). Necessário pra que a UI
 * e a exportação mostrem todas as tags do contato, não só as filtradas.
 */
export async function hydrateContactTags(
  supabase: SupabaseClient,
  contacts: Contact[]
): Promise<Contact[]> {
  if (contacts.length === 0) return contacts;
  const contactIds = contacts.map((c) => c.id);
  const { data: tagRows, error } = await supabase
    .from('contact_tags')
    .select('contact_id, tag_id, tags(id, nome, cor)')
    .in('contact_id', contactIds);
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byContact = new Map<string, { tag_id: string; tags: any }[]>();
  (tagRows ?? []).forEach((r: { contact_id: string; tag_id: string; tags: unknown }) => {
    const arr = byContact.get(r.contact_id) ?? [];
    arr.push({ tag_id: r.tag_id, tags: r.tags });
    byContact.set(r.contact_id, arr);
  });

  return contacts.map((c) => ({
    ...c,
    contact_tags: byContact.get(c.id) ?? [],
  }));
}
