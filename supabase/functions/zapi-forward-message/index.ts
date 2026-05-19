// Edge Function: zapi-forward-message
//
// Encaminha uma mensagem (texto ou mídia) de um chat para outro via Z-API.
// T37 — Fase 4 (Interações nativas do WhatsApp)
//
// Endpoint Z-API: POST /forward-message
//   Body: { phone, messageId }
//   A Z-API identifica a mensagem pelo messageId no próprio histórico da instância.
//
// Limitação documentada: só funciona para mensagens recebidas/enviadas pela mesma
// instância Z-API. Encaminhar entre instâncias diferentes não é suportado.
//
// Segurança:
//   - JWT obrigatório (requireAuth).
//   - instance_id e instance_token são encoded com encodeURIComponent (anti-SSRF).
//   - Tokens nunca aparecem na resposta.
//   - destination_phone normalizado e validado.
//   - source_message_id limitado a 255 chars.
//   - source_message_id validado como pertencente à account_id antes do encaminhamento.
//   - Mensagem encaminhada persistida em zapi_messages para auditoria.

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import { isValidPhone, normalizePhoneForZapi } from '../_shared/zapi-helpers.ts';

const ZAPI_BASE = 'https://api.z-api.io/instances';

interface ForwardBody {
  account_id?: string;
  source_message_id?: string;
  destination_phone?: string;
}

interface ZapiAccount {
  id: string;
  instance_id: string;
  instance_token: string;
  client_token: string;
  status: 'configured' | 'connected' | 'disconnected';
}

interface SourceMessage {
  body: string | null;
  media_type: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação ─────────────────────────────────────────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerEmail, callerId } = guard;

    // ── 2. Parse body ───────────────────────────────────────────────────────
    let body: ForwardBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const accountId = body.account_id?.trim();
    const sourceMessageId = body.source_message_id?.trim();
    const rawDestPhone = body.destination_phone?.trim() ?? '';

    if (!accountId) return jsonResponse(400, { error: 'account_id é obrigatório' });
    if (!sourceMessageId) return jsonResponse(400, { error: 'source_message_id é obrigatório' });
    if (sourceMessageId.length > 255) return jsonResponse(400, { error: 'source_message_id muito longo' });

    const destPhone = normalizePhoneForZapi(rawDestPhone);
    if (!isValidPhone(destPhone)) {
      return jsonResponse(400, { error: 'destination_phone inválido — informe DDD + número' });
    }

    // ── 3. Busca conta Z-API ────────────────────────────────────────────────
    const { data: account, error: accountErr } = await admin
      .from('zapi_accounts')
      .select('id, instance_id, instance_token, client_token, status')
      .eq('id', accountId)
      .maybeSingle<ZapiAccount>();

    if (accountErr) {
      console.error('zapi-forward-message: erro ao buscar conta', { code: accountErr.code });
      return jsonResponse(500, { error: 'Erro ao localizar conta' });
    }
    if (!account) return jsonResponse(404, { error: 'Conta Z-API não encontrada' });
    if (account.status === 'disconnected') {
      return jsonResponse(422, { error: 'Conta desconectada — reconecte antes de encaminhar' });
    }

    // ── 4. Valida ownership da mensagem de origem ───────────────────────────
    // Garante que source_message_id pertence a um chat da account_id informada.
    // Sem esta verificação, qualquer usuário autenticado poderia encaminhar
    // mensagens de outra conta apenas conhecendo o messageId.
    const { data: sourceMsg, error: sourceMsgErr } = await admin
      .from('zapi_messages')
      .select('body, media_type')
      .eq('account_id', accountId)
      .eq('message_id', sourceMessageId)
      .maybeSingle<SourceMessage>();

    if (sourceMsgErr) {
      console.error('zapi-forward-message: erro ao validar mensagem origem', { code: sourceMsgErr.code });
      return jsonResponse(500, { error: 'Erro ao validar mensagem de origem' });
    }
    if (!sourceMsg) {
      return jsonResponse(404, { error: 'Mensagem de origem não encontrada nesta conta' });
    }

    // ── 5. UPSERT do chat de destino ────────────────────────────────────────
    const nowIso = new Date().toISOString();
    const { data: destChat, error: chatErr } = await admin
      .from('zapi_chats')
      .upsert(
        { account_id: account.id, phone: destPhone, updated_at: nowIso },
        { onConflict: 'account_id,phone', ignoreDuplicates: false },
      )
      .select('id')
      .single();

    if (chatErr || !destChat) {
      console.error('zapi-forward-message: erro ao upsert chat destino', { code: chatErr?.code });
      return jsonResponse(500, { error: 'Erro ao preparar conversa de destino' });
    }

    // ── 6. Chamada Z-API ────────────────────────────────────────────────────
    // encodeURIComponent nos segmentos de URL (anti-SSRF — Fase 3 lesson learned)
    const url = `${ZAPI_BASE}/${encodeURIComponent(account.instance_id)}/token/${encodeURIComponent(account.instance_token)}/forward-message`;

    let zapiResp: Response;
    try {
      zapiResp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': account.client_token,
        },
        body: JSON.stringify({ phone: destPhone, messageId: sourceMessageId }),
      });
    } catch (err) {
      console.error('zapi-forward-message: fetch falhou', err instanceof Error ? err.message : '');
      return jsonResponse(502, { error: 'Falha ao contactar a Z-API' });
    }

    if (zapiResp.status === 429) {
      return jsonResponse(429, { error: 'Limite de envio atingido. Aguarde antes de tentar novamente.' });
    }

    let zapiBody: Record<string, unknown> = {};
    try {
      zapiBody = await zapiResp.json();
    } catch { /* JSON inválido — segue */ }

    if (!zapiResp.ok) {
      const detail = (zapiBody?.error as string | undefined) ?? `HTTP ${zapiResp.status}`;
      console.error('zapi-forward-message: Z-API erro', { status: zapiResp.status, detail });
      return jsonResponse(502, { error: `Z-API: ${detail}` });
    }

    // ── 7. Persiste mensagem encaminhada como outbound ──────────────────────
    // Necessário para auditoria — sem persistência não há rastro do encaminhamento.
    // messageId retornado pela Z-API identifica a nova mensagem no destino.
    const forwardedMessageId =
      (zapiBody.messageId as string | undefined) ??
      (zapiBody.id as string | undefined) ??
      (zapiBody.zaapId as string | undefined) ??
      `fwd-${crypto.randomUUID()}`;

    const preview = sourceMsg.body
      ? `↪ ${sourceMsg.body.slice(0, 80)}`
      : `↪ Mídia encaminhada`;

    const { error: msgErr } = await admin
      .from('zapi_messages')
      .insert({
        account_id: account.id,
        chat_id: destChat.id,
        message_id: forwardedMessageId,
        direction: 'outbound',
        body: sourceMsg.body ?? null,
        status: 'sent',
        sent_at: nowIso,
        media_type: sourceMsg.media_type ?? null,
      });

    if (msgErr && msgErr.code !== '23505') {
      // 23505 = conflito de idempotência — aceitável
      console.error('zapi-forward-message: erro ao persistir mensagem encaminhada', { code: msgErr.code });
    }

    // ── 8. Atualiza preview do chat de destino ──────────────────────────────
    await admin
      .from('zapi_chats')
      .update({ last_message_at: nowIso, last_message_preview: preview, updated_at: nowIso })
      .eq('id', destChat.id);

    console.log('zapi-forward-message: ok', { caller: callerEmail, callerId, account_id: accountId });
    return jsonResponse(200, { ok: true, message_id: forwardedMessageId, chat_id: destChat.id });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-forward-message crash:', msg);
    return jsonResponse(500, { error: 'Erro interno ao encaminhar mensagem' });
  }
});
