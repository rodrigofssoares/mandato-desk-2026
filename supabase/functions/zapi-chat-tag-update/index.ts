// Edge Function: zapi-chat-tag-update
//
// Adiciona ou remove uma etiqueta de uma conversa WhatsApp.
// A tabela zapi_chat_tags tem escrita bloqueada no client (service_role only),
// então esta EF é necessária como intermediária segura.
//
// Fluxo:
//   1. Valida JWT (usuário autenticado).
//   2. Verifica permissão editWhatsapp() server-side.
//   3. Lê { chat_id, tag_id, action: 'add' | 'remove' } do body.
//   4. Valida UUIDs e action.
//   5. Anti-IDOR: verifica que chat_id pertence à conta do usuário.
//   6. Verifica que tag_id existe na tabela tags.
//   7. Executa INSERT ON CONFLICT DO NOTHING (add) ou DELETE (remove).
//   8. Retorna { ok: true }.
//
// Segurança:
//   - Anti-IDOR: chat_id validado contra as contas do usuário.
//   - tag_id validado via SELECT antes da operação.
//   - created_by registrado no INSERT para auditoria.
//
// Referência: RAQ-MAND-EM073 — T45

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TagUpdateBody {
  chat_id?: string;
  tag_id?: string;
  action?: 'add' | 'remove';
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
        console.error('zapi-chat-tag-update: erro ao verificar permissão', permErr.code);
        return jsonResponse(500, { error: 'Erro ao verificar permissões' });
      }

      if (!perm || perm.pode_editar !== true) {
        console.warn('zapi-chat-tag-update: acesso negado', { callerId, callerRole });
        return jsonResponse(403, { error: 'Sem permissão para editar conversas WhatsApp' });
      }
    }

    // ── 3. Parse body ────────────────────────────────────────────────────────
    let body: TagUpdateBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const chatId = body.chat_id?.trim();
    const tagId = body.tag_id?.trim();
    const action = body.action;

    if (!chatId || !UUID_REGEX.test(chatId)) {
      return jsonResponse(400, { error: 'chat_id deve ser um UUID válido' });
    }
    if (!tagId || !UUID_REGEX.test(tagId)) {
      return jsonResponse(400, { error: 'tag_id deve ser um UUID válido' });
    }
    if (action !== 'add' && action !== 'remove') {
      return jsonResponse(400, { error: 'action deve ser "add" ou "remove"' });
    }

    // ── 4. Anti-IDOR: verifica ownership do chat ─────────────────────────────
    const { data: chat, error: chatErr } = await admin
      .from('zapi_chats')
      .select('id, account_id')
      .eq('id', chatId)
      .maybeSingle();

    if (chatErr) {
      console.error('zapi-chat-tag-update: erro ao buscar chat', chatErr.code);
      return jsonResponse(500, { error: 'Erro ao localizar conversa' });
    }
    if (!chat) {
      return jsonResponse(404, { error: 'Conversa não encontrada' });
    }

    // Para não-admins: verifica que a conta pertence ao usuário
    if (!isAdmin) {
      const { data: account } = await admin
        .from('zapi_accounts')
        .select('id')
        .eq('id', (chat as { account_id: string }).account_id)
        .eq('created_by', callerId)
        .maybeSingle();

      if (!account) {
        console.warn('zapi-chat-tag-update: tentativa cross-tenant', { callerId, chat_id: chatId });
        return jsonResponse(403, { error: 'Acesso negado: chat pertence a outra conta' });
      }
    }

    // ── 5. Verifica que tag_id existe ────────────────────────────────────────
    const { data: tag } = await admin
      .from('tags')
      .select('id')
      .eq('id', tagId)
      .maybeSingle();

    if (!tag) {
      return jsonResponse(404, { error: 'Etiqueta não encontrada' });
    }

    // ── 6. Executa operação ──────────────────────────────────────────────────
    if (action === 'add') {
      // ON CONFLICT DO NOTHING: idempotente (não retorna erro ao adicionar duplicata)
      const { error: insertErr } = await admin
        .from('zapi_chat_tags')
        .upsert(
          { chat_id: chatId, tag_id: tagId, created_by: callerId },
          { onConflict: 'chat_id,tag_id', ignoreDuplicates: true },
        );

      if (insertErr) {
        console.error('zapi-chat-tag-update: erro ao inserir tag', insertErr.code);
        return jsonResponse(500, { error: 'Erro ao adicionar etiqueta' });
      }
    } else {
      // action === 'remove'
      const { error: deleteErr } = await admin
        .from('zapi_chat_tags')
        .delete()
        .eq('chat_id', chatId)
        .eq('tag_id', tagId);

      if (deleteErr) {
        console.error('zapi-chat-tag-update: erro ao remover tag', deleteErr.code);
        return jsonResponse(500, { error: 'Erro ao remover etiqueta' });
      }
    }

    console.log('zapi-chat-tag-update: ok', {
      caller: callerEmail,
      callerId,
      chat_id: chatId,
      tag_id: tagId,
      action,
    });

    return jsonResponse(200, { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-chat-tag-update crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
