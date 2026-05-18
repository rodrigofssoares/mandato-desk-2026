// Edge Function: zapi-send-reaction
//
// Envia uma reação (emoji) a uma mensagem via Z-API.
// T36 — Fase 4 (Interações nativas do WhatsApp)
//
// Endpoint Z-API: POST /send-reaction
//   Body: { phone, messageId, reaction }
//   reaction: emoji Unicode ou "" para remover a reação.
//
// Segurança:
//   - JWT obrigatório (requireAuth).
//   - instance_id e instance_token são encoded com encodeURIComponent (anti-SSRF).
//   - Tokens nunca aparecem na resposta.
//   - reaction validada contra whitelist de emojis padrão + "" (remover).
//   - message_id limitado a 255 chars (truncamento defensivo).

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import { isValidPhone, normalizePhoneForZapi } from '../_shared/zapi-helpers.ts';

const ZAPI_BASE = 'https://api.z-api.io/instances';

/** 6 emojis padrão de reação do WhatsApp + "" (remover reação). */
const VALID_REACTIONS = new Set(['❤️', '👍', '😂', '😮', '😢', '👏', '']);

interface ReactionBody {
  account_id?: string;
  phone?: string;
  message_id?: string;
  reaction?: string;
}

interface ZapiAccount {
  id: string;
  instance_id: string;
  instance_token: string;
  client_token: string;
  status: 'configured' | 'connected' | 'disconnected';
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
    let body: ReactionBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const accountId = body.account_id?.trim();
    const rawPhone = body.phone?.trim() ?? '';
    const messageId = body.message_id?.trim();
    const reaction = body.reaction ?? '';

    if (!accountId) return jsonResponse(400, { error: 'account_id é obrigatório' });
    if (!messageId) return jsonResponse(400, { error: 'message_id é obrigatório' });
    if (messageId.length > 255) return jsonResponse(400, { error: 'message_id muito longo' });
    if (typeof reaction !== 'string') return jsonResponse(400, { error: 'reaction inválida' });
    if (!VALID_REACTIONS.has(reaction)) {
      return jsonResponse(400, { error: 'Reação inválida — use ❤️ 👍 😂 😮 😢 👏 ou "" para remover' });
    }

    const phone = normalizePhoneForZapi(rawPhone);
    if (!isValidPhone(phone)) {
      return jsonResponse(400, { error: 'Telefone inválido' });
    }

    // ── 3. Busca conta Z-API ────────────────────────────────────────────────
    const { data: account, error: accountErr } = await admin
      .from('zapi_accounts')
      .select('id, instance_id, instance_token, client_token, status')
      .eq('id', accountId)
      .maybeSingle<ZapiAccount>();

    if (accountErr) {
      console.error('zapi-send-reaction: erro ao buscar conta', { code: accountErr.code });
      return jsonResponse(500, { error: 'Erro ao localizar conta' });
    }
    if (!account) return jsonResponse(404, { error: 'Conta Z-API não encontrada' });
    if (account.status === 'disconnected') {
      return jsonResponse(422, { error: 'Conta desconectada — reconecte antes de enviar' });
    }

    // ── 4. Chamada Z-API ────────────────────────────────────────────────────
    // encodeURIComponent nos segmentos de URL (anti-SSRF — Fase 3 lesson learned)
    const url = `${ZAPI_BASE}/${encodeURIComponent(account.instance_id)}/token/${encodeURIComponent(account.instance_token)}/send-reaction`;

    let zapiResp: Response;
    try {
      zapiResp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': account.client_token,
        },
        body: JSON.stringify({ phone, messageId: messageId, reaction }),
      });
    } catch (err) {
      console.error('zapi-send-reaction: fetch falhou', err instanceof Error ? err.message : '');
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
      console.error('zapi-send-reaction: Z-API erro', { status: zapiResp.status, detail });
      return jsonResponse(502, { error: `Z-API: ${detail}` });
    }

    console.log('zapi-send-reaction: ok', { caller: callerEmail, callerId, account_id: accountId });
    return jsonResponse(200, { ok: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-send-reaction crash:', msg);
    return jsonResponse(500, { error: 'Erro interno ao enviar reação' });
  }
});
