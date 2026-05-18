// Edge Function: zapi-chat-update
//
// Patch parcial de campos de estado de um chat Z-API.
// Campos suportados: status, assigned_to, pinned, archived, snoozed_until.
// RLS bloqueia escrita direta do client — esta EF usa service_role.
//
// Fluxo:
//   1. Valida JWT (qualquer usuário com perfil ATIVO).
//   2. Lê { chat_id, patch } do body.
//   3. Valida chat_id como UUID.
//   4. Valida os campos do patch (status no enum, assigned_to é UUID de perfil ativo).
//   5. Confirma que o chat existe.
//   6. Aplica somente os campos presentes no patch.
//   7. Retorna o chat atualizado.
//
// Erros:
//   - 400 payload inválido (sem chat_id, sem patch, UUID malformado).
//   - 401 sem JWT / JWT inválido.
//   - 403 perfil não autorizado (status ATIVO ou sem permissão de edição WhatsApp).
//   - 404 chat não encontrado (ou assigned_to não encontrado nos profiles).
//   - 422 valor inválido no enum de status.
//   - 500 erro interno.
//
// Segurança:
//   - Somente os campos do patch são aplicados (campo ausente = não alterado).
//   - assigned_to é validado: o perfil deve existir e ter status_aprovacao ATIVO.
//   - Nenhum token ou secret é lido/retornado.
//   - Permissão de edição WhatsApp verificada server-side: admin sempre passa;
//     demais roles precisam ter pode_editar=true na secao 'whatsapp' em
//     permissoes_perfil (equivalente ao can.editWhatsapp() do frontend).
//
// Referência: RAQ-MAND — FASE 0 T04

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_ENUM = ['aberta', 'em_atendimento', 'aguardando', 'finalizada'] as const;
type ChatStatus = typeof STATUS_ENUM[number];

interface ChatPatch {
  status?: string;
  assigned_to?: string | null;
  pinned?: boolean;
  archived?: boolean;
  snoozed_until?: string | null;
  /** T26: true = seta unread_count=1; false = zera unread_count=0. */
  unread?: boolean;
}

interface ChatUpdateBody {
  chat_id?: string;
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

    // ── 1b. Autorização server-side — permissão de edição WhatsApp ───────────
    // Admin sempre tem acesso. Para demais roles, verifica permissoes_perfil.
    // Isso espelha o can.editWhatsapp() do frontend, mas com garantia server-side.
    const isAdmin = callerRole === 'admin';
    if (!isAdmin) {
      const { data: perm, error: permErr } = await admin
        .from('permissoes_perfil')
        .select('pode_editar')
        .eq('role', callerRole)
        .eq('secao', 'whatsapp')
        .maybeSingle();

      if (permErr) {
        console.error('zapi-chat-update: erro ao verificar permissão', { code: permErr.code });
        return jsonResponse(500, { error: 'Erro ao verificar permissões' });
      }

      if (!perm || perm.pode_editar !== true) {
        console.warn('zapi-chat-update: acesso negado', { callerId, callerRole });
        return jsonResponse(403, { error: 'Sem permissão para editar conversas WhatsApp' });
      }
    }

    // ── 2. Parse body ────────────────────────────────────────────────────────
    let body: ChatUpdateBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const chatId = body.chat_id?.trim();
    const patch = body.patch;

    if (!chatId) {
      return jsonResponse(400, { error: 'chat_id é obrigatório' });
    }
    if (!UUID_REGEX.test(chatId)) {
      return jsonResponse(400, { error: 'chat_id deve ser um UUID válido' });
    }
    if (!patch || typeof patch !== 'object') {
      return jsonResponse(400, { error: 'patch é obrigatório e deve ser um objeto' });
    }

    // Verifica se há pelo menos um campo a atualizar
    const hasPatchFields = (
      'status' in patch ||
      'assigned_to' in patch ||
      'pinned' in patch ||
      'archived' in patch ||
      'snoozed_until' in patch ||
      'unread' in patch
    );
    if (!hasPatchFields) {
      return jsonResponse(400, { error: 'patch não contém campos reconhecidos' });
    }

    // ── 3. Valida campos do patch ────────────────────────────────────────────

    // Validação de status
    if ('status' in patch && patch.status !== undefined) {
      if (!STATUS_ENUM.includes(patch.status as ChatStatus)) {
        return jsonResponse(422, {
          error: 'status inválido. Valores aceitos: aberta, em_atendimento, aguardando, finalizada',
        });
      }
    }

    // Validação de pinned / archived / unread (devem ser boolean)
    if ('pinned' in patch && patch.pinned !== undefined && typeof patch.pinned !== 'boolean') {
      return jsonResponse(400, { error: 'pinned deve ser boolean' });
    }
    if ('archived' in patch && patch.archived !== undefined && typeof patch.archived !== 'boolean') {
      return jsonResponse(400, { error: 'archived deve ser boolean' });
    }
    if ('unread' in patch && patch.unread !== undefined && typeof patch.unread !== 'boolean') {
      return jsonResponse(400, { error: 'unread deve ser boolean' });
    }

    // Validação de snoozed_until (deve ser ISO date string no futuro ou null)
    if ('snoozed_until' in patch && patch.snoozed_until !== null && patch.snoozed_until !== undefined) {
      const dt = new Date(patch.snoozed_until);
      if (isNaN(dt.getTime())) {
        return jsonResponse(400, { error: 'snoozed_until deve ser uma data ISO 8601 válida ou null' });
      }
      if (dt.getTime() <= Date.now()) {
        return jsonResponse(400, { error: 'snoozed_until deve ser uma data futura' });
      }
    }

    // Validação de assigned_to: deve ser UUID de perfil ATIVO ou null
    if ('assigned_to' in patch && patch.assigned_to !== null && patch.assigned_to !== undefined) {
      if (!UUID_REGEX.test(patch.assigned_to)) {
        return jsonResponse(400, { error: 'assigned_to deve ser um UUID válido ou null' });
      }

      // Confirma que o perfil existe e está ATIVO
      const { data: targetProfile, error: profileErr } = await admin
        .from('profiles')
        .select('id, status_aprovacao')
        .eq('id', patch.assigned_to)
        .maybeSingle();

      if (profileErr) {
        console.error('zapi-chat-update: erro ao validar assigned_to', { code: profileErr.code });
        return jsonResponse(500, { error: 'Erro ao validar usuário atribuído' });
      }
      if (!targetProfile) {
        return jsonResponse(404, { error: 'Usuário para atribuição não encontrado' });
      }
      if (targetProfile.status_aprovacao !== 'ATIVO') {
        return jsonResponse(422, { error: 'Usuário para atribuição não está ativo' });
      }
    }

    // ── 4. Confirma que o chat existe ────────────────────────────────────────
    const { data: chat, error: chatErr } = await admin
      .from('zapi_chats')
      .select('id, account_id')
      .eq('id', chatId)
      .maybeSingle();

    if (chatErr) {
      console.error('zapi-chat-update: erro ao buscar chat', { code: chatErr.code });
      return jsonResponse(500, { error: 'Erro ao localizar conversa' });
    }
    if (!chat) {
      return jsonResponse(404, { error: 'Conversa não encontrada' });
    }

    // ── 5. Monta o update somente com campos presentes ───────────────────────
    const updatePayload: Record<string, string | boolean | number | null> = {
      updated_at: new Date().toISOString(),
    };

    if ('status' in patch)        updatePayload.status = patch.status;
    if ('assigned_to' in patch)   updatePayload.assigned_to = patch.assigned_to ?? null;
    if ('pinned' in patch)        updatePayload.pinned = patch.pinned;
    if ('archived' in patch)      updatePayload.archived = patch.archived;
    if ('snoozed_until' in patch) updatePayload.snoozed_until = patch.snoozed_until ?? null;
    // T26: unread=true → unread_count=1; unread=false → unread_count=0
    if ('unread' in patch && patch.unread !== undefined) {
      updatePayload.unread_count = patch.unread ? 1 : 0;
    }

    // ── 6. Aplica o update ───────────────────────────────────────────────────
    const { data: updated, error: updateErr } = await admin
      .from('zapi_chats')
      .update(updatePayload)
      .eq('id', chatId)
      .select('id, status, assigned_to, pinned, archived, snoozed_until, unread_count, updated_at')
      .single();

    if (updateErr) {
      console.error('zapi-chat-update: erro ao atualizar chat', { code: updateErr.code });
      return jsonResponse(500, { error: 'Erro ao atualizar conversa' });
    }

    console.log('zapi-chat-update: ok', {
      caller: callerEmail,
      callerId,
      chat_id: chatId,
      account_id: chat.account_id,
      fields: Object.keys(patch),
    });

    return jsonResponse(200, { ok: true, chat: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-chat-update crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
