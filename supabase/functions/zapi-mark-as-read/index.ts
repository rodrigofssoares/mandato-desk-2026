// Edge Function: zapi-mark-as-read
//
// Zera o unread_count de um chat e atualiza updated_at.
// Substitui o no-op de useMarkChatAsRead — RLS bloqueia escrita do client.
//
// Fluxo:
//   1. Valida JWT (qualquer usuário com perfil ATIVO — requireAuth).
//   2. Lê { chat_id } do body JSON.
//   3. Confirma que o chat existe (via service_role — bypassa RLS).
//   4. UPDATE zapi_chats SET unread_count=0, updated_at=now() WHERE id=chat_id.
//   5. Retorna { ok: true }.
//
// Erros:
//   - 400 sem chat_id ou chat_id não é UUID válido.
//   - 401 sem JWT ou JWT inválido.
//   - 403 perfil não autorizado (status_aprovacao != 'ATIVO').
//   - 404 chat não encontrado.
//   - 500 erro interno.
//
// Segurança:
//   - Nenhum dado sensível (tokens, secrets) é lido ou retornado.
//   - O chat_id é validado como UUID antes de qualquer query.
//   - service_role usado apenas para a operação de UPDATE pontual.
//
// Referência: RAQ-MAND — FASE 0 T03

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';

// Regex UUID v4 simples para validação de input
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MarkAsReadBody {
  chat_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação ──────────────────────────────────────────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerEmail } = guard;

    // ── 2. Parse body ────────────────────────────────────────────────────────
    let body: MarkAsReadBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const chatId = body.chat_id?.trim();

    if (!chatId) {
      return jsonResponse(400, { error: 'chat_id é obrigatório' });
    }
    if (!UUID_REGEX.test(chatId)) {
      return jsonResponse(400, { error: 'chat_id deve ser um UUID válido' });
    }

    // ── 3. Confirma que o chat existe ────────────────────────────────────────
    const { data: chat, error: chatErr } = await admin
      .from('zapi_chats')
      .select('id, account_id, unread_count')
      .eq('id', chatId)
      .maybeSingle();

    if (chatErr) {
      console.error('zapi-mark-as-read: erro ao buscar chat', { code: chatErr.code });
      return jsonResponse(500, { error: 'Erro ao localizar conversa' });
    }
    if (!chat) {
      return jsonResponse(404, { error: 'Conversa não encontrada' });
    }

    // Já está zerado — retorna ok sem UPDATE desnecessário
    if (chat.unread_count === 0) {
      return jsonResponse(200, { ok: true, updated: false });
    }

    // ── 4. Zera unread_count ─────────────────────────────────────────────────
    const { error: updateErr } = await admin
      .from('zapi_chats')
      .update({
        unread_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId);

    if (updateErr) {
      console.error('zapi-mark-as-read: erro ao atualizar', { code: updateErr.code });
      return jsonResponse(500, { error: 'Erro ao marcar como lida' });
    }

    console.log('zapi-mark-as-read: ok', {
      caller: callerEmail,
      callerId,
      chat_id: chatId,
      account_id: chat.account_id,
    });

    return jsonResponse(200, { ok: true, updated: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-mark-as-read crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
