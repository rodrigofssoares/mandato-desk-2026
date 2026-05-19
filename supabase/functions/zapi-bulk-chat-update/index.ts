// Edge Function: zapi-bulk-chat-update
//
// Atualização em lote de múltiplos chats Z-API com um único UPDATE.
// Mais eficiente do que N chamadas individuais a zapi-chat-update.
//
// Fluxo:
//   1. Valida JWT (usuário autenticado).
//   2. Verifica permissão editWhatsapp() server-side.
//   3. Lê { chat_ids: string[], patch: ChatPatch } do body.
//   4. Valida chat_ids (1–100 itens, UUIDs válidos).
//   5. Valida patch (campos suportados: status, assigned_to, archived, pinned).
//   6. Se assigned_to fornecido: valida que o alvo (a) existe, (b) está ATIVO e
//      (c) tem permissão de WhatsApp (role admin bypassa). Retorna 422 se o alvo
//      não tem acesso a WhatsApp.
//   7. Anti-IDOR (single-tenant): valida que o chamador tem permissão de editar
//      WhatsApp + que todos os chat_ids existem na tabela. NÃO escopa por
//      created_by (contas são criadas pelo admin — design single-tenant, mig 045).
//   8. Executa UPDATE em batch com WHERE id = ANY($1).
//   9. Retorna { ok: true, updated: N }.
//
// Segurança:
//   - Verificação de permissão WhatsApp do chamador (passo 2).
//   - Verificação de permissão WhatsApp do alvo de assigned_to (passo 6).
//   - Existência de todos os chat_ids validada antes do UPDATE (passo 7).
//   - Limite de 100 chat_ids por chamada (anti-abuso).
//   - Validação de UUID para todos os chat_ids.
//   - Campos do patch validados individualmente.
//
// Achados corrigidos:
//   ALTA-2a: assigned_to agora valida permissão WhatsApp do alvo.
//   ALTA-2b: anti-IDOR não escopa mais por created_by (quebrava para não-admins
//            em sistema single-tenant). Valida existência dos chats sem filtro
//            de owner.
//
// Referência: RAQ-MAND-EM073 — Security Fix ALTA-2

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_ENUM = ['aberta', 'em_atendimento', 'aguardando', 'finalizada'] as const;
type ChatStatus = typeof STATUS_ENUM[number];

interface ChatPatch {
  status?: string;
  assigned_to?: string | null;
  pinned?: boolean;
  archived?: boolean;
}

interface BulkUpdateBody {
  chat_ids?: string[];
  patch?: ChatPatch;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação ──────────────────────────────────────────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerEmail, callerRole } = guard;

    // ── 2. Autorização: permissão editWhatsapp() server-side ─────────────────
    const isAdmin = callerRole === 'admin';
    if (!isAdmin) {
      const { data: perm, error: permErr } = await admin
        .from('permissoes_perfil')
        .select('pode_editar')
        .eq('role', callerRole)
        .eq('secao', 'whatsapp')
        .maybeSingle();

      if (permErr) {
        console.error('zapi-bulk-chat-update: erro ao verificar permissão', permErr.code);
        return jsonResponse(500, { error: 'Erro ao verificar permissões' });
      }

      if (!perm || perm.pode_editar !== true) {
        console.warn('zapi-bulk-chat-update: acesso negado', { callerId, callerRole });
        return jsonResponse(403, { error: 'Sem permissão para editar conversas WhatsApp' });
      }
    }

    // ── 3. Parse body ────────────────────────────────────────────────────────
    let body: BulkUpdateBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const chatIds = body.chat_ids;
    const patch = body.patch;

    if (!Array.isArray(chatIds) || chatIds.length === 0) {
      return jsonResponse(400, { error: 'chat_ids deve ser um array não-vazio' });
    }

    // ── 4. Valida limites e UUIDs ────────────────────────────────────────────
    if (chatIds.length > 100) {
      return jsonResponse(422, { error: 'Máximo de 100 chat_ids por chamada' });
    }

    for (const id of chatIds) {
      if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
        return jsonResponse(400, { error: `chat_id inválido: ${id}` });
      }
    }

    if (!patch || typeof patch !== 'object') {
      return jsonResponse(400, { error: 'patch é obrigatório e deve ser um objeto' });
    }

    const hasPatchFields = (
      'status' in patch ||
      'assigned_to' in patch ||
      'pinned' in patch ||
      'archived' in patch
    );
    if (!hasPatchFields) {
      return jsonResponse(400, { error: 'patch não contém campos reconhecidos' });
    }

    // ── 5. Valida campos do patch ────────────────────────────────────────────
    if ('status' in patch && patch.status !== undefined) {
      if (!STATUS_ENUM.includes(patch.status as ChatStatus)) {
        return jsonResponse(422, {
          error: 'status inválido. Valores aceitos: aberta, em_atendimento, aguardando, finalizada',
        });
      }
    }

    if ('pinned' in patch && patch.pinned !== undefined && typeof patch.pinned !== 'boolean') {
      return jsonResponse(400, { error: 'pinned deve ser boolean' });
    }

    if ('archived' in patch && patch.archived !== undefined && typeof patch.archived !== 'boolean') {
      return jsonResponse(400, { error: 'archived deve ser boolean' });
    }

    // ── 6. Valida assigned_to: existência, status ATIVO e permissão WhatsApp ──
    // Achado ALTA-2a: antes só verificava se o perfil estava ATIVO.
    // Agora também valida que o alvo TEM permissão de acesso a WhatsApp.
    if ('assigned_to' in patch && patch.assigned_to !== null && patch.assigned_to !== undefined) {
      if (!UUID_REGEX.test(patch.assigned_to)) {
        return jsonResponse(400, { error: 'assigned_to deve ser um UUID válido ou null' });
      }

      // Busca perfil do alvo
      const { data: targetProfile } = await admin
        .from('profiles')
        .select('id, status_aprovacao, role')
        .eq('id', patch.assigned_to)
        .maybeSingle();

      if (!targetProfile) {
        return jsonResponse(404, { error: 'Usuário para atribuição não encontrado' });
      }
      if (targetProfile.status_aprovacao !== 'ATIVO') {
        return jsonResponse(422, { error: 'Usuário para atribuição não está ativo' });
      }

      // Admin sempre pode ser alvo de atribuição — bypassa check de permissão
      const targetIsAdmin = targetProfile.role === 'admin';
      if (!targetIsAdmin) {
        // Verifica que o alvo tem permissão de acesso a WhatsApp
        const { data: targetPerm } = await admin
          .from('permissoes_perfil')
          .select('pode_ver')
          .eq('role', targetProfile.role)
          .eq('secao', 'whatsapp')
          .maybeSingle();

        if (!targetPerm || targetPerm.pode_ver !== true) {
          return jsonResponse(422, {
            error: 'Usuário para atribuição não tem permissão de acesso ao WhatsApp',
          });
        }
      }
    }

    // ── 7. Anti-IDOR (single-tenant): verifica que os chat_ids existem ────────
    // Achado ALTA-2b: o anti-IDOR anterior escopava por zapi_accounts.created_by
    // = callerId, mas em sistema single-tenant (design mig 045) as contas são
    // criadas pelo admin — não-admins ficavam sem acesso. Corrigido: valida apenas
    // a existência dos chats, sem filtro de owner. A permissão do chamador já
    // foi verificada no passo 2.
    const { data: existingChats, error: chatsErr } = await admin
      .from('zapi_chats')
      .select('id')
      .in('id', chatIds);

    if (chatsErr) {
      console.error('zapi-bulk-chat-update: erro ao verificar chats', chatsErr.code);
      return jsonResponse(500, { error: 'Erro ao verificar conversas' });
    }

    const foundIds = new Set((existingChats ?? []).map((c: { id: string }) => c.id));

    // ── 8. UPDATE em batch ───────────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ('status' in patch)      updatePayload.status = patch.status;
    if ('assigned_to' in patch) updatePayload.assigned_to = patch.assigned_to ?? null;
    if ('pinned' in patch)      updatePayload.pinned = patch.pinned;
    if ('archived' in patch)    updatePayload.archived = patch.archived;

    // Filtra apenas os IDs que existem no banco (seguro)
    const validIds = chatIds.filter((id) => foundIds.has(id));
    if (validIds.length === 0) {
      return jsonResponse(200, { ok: true, updated: 0 });
    }

    const { error: updateErr, count } = await admin
      .from('zapi_chats')
      .update(updatePayload, { count: 'exact' })
      .in('id', validIds);

    if (updateErr) {
      console.error('zapi-bulk-chat-update: erro ao atualizar', updateErr.code);
      return jsonResponse(500, { error: 'Erro ao atualizar conversas' });
    }

    const updated = count ?? validIds.length;

    console.log('zapi-bulk-chat-update: ok', {
      caller: callerEmail,
      callerId,
      updated,
      fields: Object.keys(patch),
    });

    return jsonResponse(200, { ok: true, updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-bulk-chat-update crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
