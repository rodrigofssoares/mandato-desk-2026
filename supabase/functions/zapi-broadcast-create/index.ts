// Edge Function: zapi-broadcast-create
//
// Resolve o segmento de uma campanha broadcast e cria os targets individuais.
// Chamada pelo usuário na UI (após criar o rascunho da campanha).
//
// Fluxo:
//   1. Valida JWT de usuário autenticado (requireAuth).
//   2. Verifica permissão de edição WhatsApp.
//   3. Lê { broadcast_id } do body.
//   4. Busca o broadcast — verifica que created_by = auth.uid() e status = 'rascunho'.
//   5. Verifica feature flag c17 na conta.
//   6. Resolve segmento: busca contacts com optin_whatsapp=true aplicando segment_filters.
//      Também busca contatos SEM opt-in para criar targets bloqueados (auditoria).
//   7. Insere zapi_broadcast_targets (elegíveis + bloqueados).
//   8. Atualiza total_targets e muda status para 'agendado' ou 'enviando'.
//
// Segurança:
//   - Apenas o criador pode disparar sua campanha (created_by = auth.uid()).
//   - Double-check opt-in: filtro na query + verificação por contato.
//   - INSERT em tabelas broadcast: apenas via service_role.
//   - 422 se broadcast não está em 'rascunho'.
//
// Referência: RAQ-MAND-EM073 — T64 (Fase 6 Onda A)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import { isFeatureEnabled } from '../_shared/feature-flags.ts';
import { isValidPhone, normalizePhoneForZapi } from '../_shared/zapi-helpers.ts';

interface DraftInput {
  account_id: string;
  title: string;
  body: string;
  tipo: 'mensagem' | 'enquete';
  poll_question?: string | null;
  poll_options?: string[] | null;
  segment_filters: {
    tags?: string[];
    bairro?: string;
    zona_eleitoral?: string;
  };
  ritmo_por_minuto: number;
  scheduled_at?: string | null;
}

interface CreateBody {
  /** Modo 1: resolve targets de um rascunho existente */
  broadcast_id?: string;
  /** Modo 2: cria rascunho + resolve targets em um passo (usado pela UI do composer) */
  create_draft?: DraftInput;
}

interface SegmentFilters {
  tags?: string[];
  bairro?: string;
  zona_eleitoral?: string;
}

interface ContactRow {
  id: string;
  nome: string;
  whatsapp: string | null;
  optin_whatsapp: boolean;
  optin_data: string | null;
  merged_into: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação ────────────────────────────────────────────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerRole } = guard;

    // ── 1b. Permissão WhatsApp ─────────────────────────────────────────────────
    const isAdminRole = callerRole === 'admin';
    if (!isAdminRole) {
      const { data: perm } = await admin
        .from('permissoes_perfil')
        .select('pode_editar')
        .eq('role', callerRole)
        .eq('secao', 'whatsapp')
        .maybeSingle();

      if (!perm || perm.pode_editar !== true) {
        return jsonResponse(403, { error: 'Sem permissão para criar campanhas WhatsApp' });
      }
    }

    // ── 2. Parse body ──────────────────────────────────────────────────────────
    let body: CreateBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    let broadcastId = body.broadcast_id?.trim();

    // ── Modo 2: criar rascunho + resolver em um passo ────────────────────────
    if (!broadcastId && body.create_draft) {
      const draft = body.create_draft;
      if (!draft.account_id || !draft.title || !draft.body) {
        return jsonResponse(400, { error: 'account_id, title e body são obrigatórios para criar rascunho' });
      }

      // ── ALTA-4: valida segment_filters antes do INSERT ──────────────────────
      // Rejeita se nenhum filtro de segmento foi fornecido (prevenção de broadcast total acidental)
      const draftFilters = (draft.segment_filters ?? {}) as SegmentFilters;
      const draftHasFilter =
        (draftFilters.tags && draftFilters.tags.length > 0) ||
        (draftFilters.bairro && draftFilters.bairro.trim().length > 0) ||
        (draftFilters.zona_eleitoral && draftFilters.zona_eleitoral.trim().length > 0);
      if (!draftHasFilter) {
        return jsonResponse(422, {
          error: 'Broadcast exige ao menos 1 filtro de segmento (tags, bairro ou zona_eleitoral). Sem filtros, a campanha atingiria a base inteira.',
        });
      }

      // ── ALTA-4: verifica que account_id existe ANTES do INSERT ─────────────
      const { data: draftAccount } = await admin
        .from('zapi_accounts')
        .select('id, status, recursos_config')
        .eq('id', draft.account_id)
        .maybeSingle();

      if (!draftAccount) {
        return jsonResponse(403, { error: 'Conta Z-API não encontrada ou sem permissão' });
      }
      if (!isFeatureEnabled(draftAccount.recursos_config, 'c17')) {
        return jsonResponse(403, { error: 'Feature de broadcast (c17) não habilitada nesta conta' });
      }
      if (draftAccount.status === 'disconnected') {
        return jsonResponse(422, { error: 'Conta Z-API desconectada' });
      }

      const { data: newBroadcast, error: insertErr } = await admin
        .from('zapi_broadcasts')
        .insert({
          account_id: draft.account_id,
          title: draft.title,
          body: draft.body,
          tipo: draft.tipo ?? 'mensagem',
          poll_question: draft.poll_question ?? null,
          poll_options: draft.poll_options ? JSON.stringify(draft.poll_options) : null,
          segment_filters: draft.segment_filters ?? {},
          ritmo_por_minuto: draft.ritmo_por_minuto ?? 10,
          scheduled_at: draft.scheduled_at ?? null,
          status: 'rascunho',
          created_by: callerId,
        })
        .select('id')
        .single();

      if (insertErr || !newBroadcast) {
        console.error('zapi-broadcast-create: erro ao criar rascunho', insertErr?.code);
        return jsonResponse(500, { error: 'Erro ao criar rascunho de campanha' });
      }

      broadcastId = newBroadcast.id;
    }

    if (!broadcastId) {
      return jsonResponse(400, { error: 'broadcast_id ou create_draft é obrigatório' });
    }

    // ── 3. Busca o broadcast ───────────────────────────────────────────────────
    const { data: broadcast, error: bErr } = await admin
      .from('zapi_broadcasts')
      .select('id, account_id, status, segment_filters, ritmo_por_minuto, scheduled_at, created_by, tipo')
      .eq('id', broadcastId)
      .maybeSingle();

    if (bErr) {
      console.error('zapi-broadcast-create: erro ao buscar broadcast', bErr.code);
      return jsonResponse(500, { error: 'Erro ao localizar campanha' });
    }
    if (!broadcast) {
      return jsonResponse(404, { error: 'Campanha não encontrada' });
    }
    if (broadcast.created_by !== callerId) {
      return jsonResponse(403, { error: 'Sem permissão sobre esta campanha' });
    }
    if (broadcast.status !== 'rascunho') {
      return jsonResponse(422, {
        error: `Campanha não está em rascunho (status atual: ${broadcast.status})`,
      });
    }

    // ── 4. Verifica feature flag c17 + existência de conta (ALTA-4: antes de qualquer operação) ──
    // Nota: se chegamos via Modo 2 (create_draft), a conta já foi validada acima.
    // Para Modo 1 (broadcast_id existente), validamos aqui.
    const { data: account } = await admin
      .from('zapi_accounts')
      .select('id, status, recursos_config')
      .eq('id', broadcast.account_id)
      .maybeSingle();

    if (!account) {
      // ALTA-4: conta não encontrada — broadcast órfão, rejeitar
      return jsonResponse(403, { error: 'Conta Z-API vinculada à campanha não encontrada ou sem permissão' });
    }
    if (!isFeatureEnabled(account.recursos_config, 'c17')) {
      return jsonResponse(403, { error: 'Feature de broadcast (c17) não habilitada nesta conta' });
    }
    if (account.status === 'disconnected') {
      return jsonResponse(422, { error: 'Conta Z-API desconectada' });
    }

    // ── 5. Resolve segmento ────────────────────────────────────────────────────
    // CRÍTICA-2: rejeita se segment_filters não tiver NENHUM filtro (broadcast total acidental).
    const filters = (broadcast.segment_filters ?? {}) as SegmentFilters;

    const hasSegmentFilter =
      (filters.tags && filters.tags.length > 0) ||
      (filters.bairro && filters.bairro.trim().length > 0) ||
      (filters.zona_eleitoral && filters.zona_eleitoral.trim().length > 0);

    if (!hasSegmentFilter) {
      return jsonResponse(422, {
        error: 'Broadcast exige ao menos 1 filtro de segmento (tags, bairro ou zona_eleitoral). Sem filtros, a campanha atingiria a base inteira.',
      });
    }

    // Busca TODOS os contatos que satisfazem os filtros (com e sem opt-in)
    // para criar targets corretos (elegíveis = pendente, sem opt-in = bloqueado).

    // Query base: apenas contatos não-merged com whatsapp preenchido
    let query = admin
      .from('contacts')
      .select('id, nome, whatsapp, optin_whatsapp, optin_data, merged_into')
      .is('merged_into', null)
      .not('whatsapp', 'is', null);

    // Filtro por bairro
    if (filters.bairro) {
      query = query.ilike('bairro', `%${filters.bairro}%`);
    }

    // Filtro por zona eleitoral
    if (filters.zona_eleitoral) {
      query = query.ilike('zona_eleitoral', `%${filters.zona_eleitoral}%`);
    }

    const { data: contacts, error: cErr } = await query;

    if (cErr) {
      console.error('zapi-broadcast-create: erro ao buscar contatos', cErr.code);
      return jsonResponse(500, { error: 'Erro ao resolver segmento' });
    }

    let allContacts = (contacts ?? []) as ContactRow[];

    // Filtro por tags (server-side via subquery — não pode usar !inner no select encadeado)
    if (filters.tags && filters.tags.length > 0) {
      const { data: taggedContacts, error: tErr } = await admin
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', filters.tags);

      if (tErr) {
        console.error('zapi-broadcast-create: erro ao buscar tags', tErr.code);
        return jsonResponse(500, { error: 'Erro ao filtrar por tags' });
      }

      const taggedIds = new Set((taggedContacts ?? []).map((t) => t.contact_id));
      allContacts = allContacts.filter((c) => taggedIds.has(c.id));
    }

    // ── CRÍTICA-2: teto de 500 alvos elegíveis para não-admin ─────────────────
    // Conta apenas elegíveis (com opt-in + optin_data) para o teto
    const eligiblePrecount = allContacts.filter(
      (c) => c.optin_whatsapp && c.optin_data
    ).length;

    if (!isAdminRole && eligiblePrecount > 500) {
      return jsonResponse(403, {
        error: `Campanhas acima de 500 alvos elegíveis exigem permissão de admin. Esta campanha teria ${eligiblePrecount} alvos.`,
        eligible_count: eligiblePrecount,
      });
    }

    // ── 6. Cria targets ────────────────────────────────────────────────────────
    const targets: Array<{
      broadcast_id: string;
      contact_id: string;
      phone: string;
      status: 'pendente' | 'bloqueado';
      bloqueio_motivo: string | null;
    }> = [];

    let eligibleCount = 0;

    for (const contact of allContacts) {
      const rawPhone = contact.whatsapp;
      if (!rawPhone) continue;

      const phone = normalizePhoneForZapi(rawPhone);
      if (!isValidPhone(phone)) {
        targets.push({
          broadcast_id: broadcastId,
          contact_id: contact.id,
          phone: rawPhone.slice(0, 32),
          status: 'bloqueado',
          bloqueio_motivo: 'invalid_phone',
        });
        continue;
      }

      // Double-check opt-in (verificação primária — bloqueio se não tiver)
      // CRÍTICA-1 + CRÍTICA-3 (EFs): optin_data IS NOT NULL obrigatório (opt-in sem data = inválido)
      if (!contact.optin_whatsapp || !contact.optin_data) {
        targets.push({
          broadcast_id: broadcastId,
          contact_id: contact.id,
          phone,
          status: 'bloqueado',
          bloqueio_motivo: 'sem_optin',
        });
        continue;
      }

      targets.push({
        broadcast_id: broadcastId,
        contact_id: contact.id,
        phone,
        status: 'pendente',
        bloqueio_motivo: null,
      });
      eligibleCount++;
    }

    // ── CRÍTICA-2b: zero elegíveis → não marcar como enviando ─────────────────
    // Se nenhum contato no segmento tem optin_whatsapp=true + optin_data, o
    // broadcast ficaria preso em 'enviando' para sempre (cron jamais encontra
    // targets 'pendente'). Retornamos 422 sem alterar o status do rascunho.
    if (eligibleCount === 0) {
      // Se havia targets bloqueados (sem opt-in), insere mesmo assim para auditoria
      if (targets.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < targets.length; i += BATCH_SIZE) {
          const batch = targets.slice(i, i + BATCH_SIZE);
          await admin.from('zapi_broadcast_targets').insert(batch);
          // Ignora erro de inserção de auditoria — não deve bloquear a resposta
        }
      }

      // Modo 1 (broadcast_id existente já em rascunho): marca como 'concluido'
      // com total_targets=0 para que não fique em estado indeterminado.
      if (!body.create_draft) {
        await admin
          .from('zapi_broadcasts')
          .update({
            total_targets: 0,
            status: 'concluido',
            finished_at: new Date().toISOString(),
          })
          .eq('id', broadcastId);
      }

      console.warn('zapi-broadcast-create: zero elegíveis no segmento', {
        broadcast_id: broadcastId,
        total_contacts: allContacts.length,
        blocked: targets.length,
      });

      return jsonResponse(422, {
        error: 'Nenhum contato elegível no segmento (verifique opt-in). Todos os contatos do segmento estão bloqueados ou sem consentimento registrado.',
        eligible_count: 0,
        blocked: targets.length,
      });
    }

    // Insere targets em lote (service_role bypassa RLS)
    if (targets.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        const batch = targets.slice(i, i + BATCH_SIZE);
        const { error: insertErr } = await admin
          .from('zapi_broadcast_targets')
          .insert(batch);

        if (insertErr) {
          console.error('zapi-broadcast-create: erro ao inserir targets (batch)', insertErr.code);
          return jsonResponse(500, { error: 'Erro ao criar targets da campanha' });
        }
      }
    }

    // ── 7. Atualiza broadcast com totais e novo status ─────────────────────────
    const now = new Date();
    const isScheduledFuture =
      broadcast.scheduled_at && new Date(broadcast.scheduled_at) > now;
    const newStatus = isScheduledFuture ? 'agendado' : 'enviando';

    const { error: updateErr } = await admin
      .from('zapi_broadcasts')
      .update({
        total_targets: eligibleCount,
        status: newStatus,
        started_at: newStatus === 'enviando' ? now.toISOString() : null,
      })
      .eq('id', broadcastId);

    if (updateErr) {
      console.error('zapi-broadcast-create: erro ao atualizar broadcast', updateErr.code);
      return jsonResponse(500, { error: 'Erro ao atualizar status da campanha' });
    }

    console.log('zapi-broadcast-create: concluído', {
      broadcast_id: broadcastId,
      total_contacts: allContacts.length,
      eligible: eligibleCount,
      blocked: targets.length - eligibleCount,
      new_status: newStatus,
    });

    return jsonResponse(200, {
      ok: true,
      broadcast_id: broadcastId,
      total_targets: eligibleCount,
      blocked: targets.length - eligibleCount,
      status: newStatus,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-broadcast-create crash:', msg);
    return jsonResponse(500, { error: 'Erro interno ao criar campanha' });
  }
});
