// Edge Function: zapi-send-location
//
// Envia uma mensagem de localização via Z-API e persiste em zapi_messages.
// T38 — Fase 4 (Interações nativas do WhatsApp)
//
// Endpoint Z-API: POST /send-location
//   Body: { phone, lat, lng, name?, address? }
//
// A mensagem inserida em zapi_messages usa media_type='location' com
// media_metadata = { latitude, longitude, name, address } — mesma estrutura
// usada para localização recebida (webhook). O bubble de localização já existe.
//
// Segurança:
//   - JWT obrigatório (requireAuth).
//   - instance_id e instance_token são encoded com encodeURIComponent (anti-SSRF).
//   - Tokens nunca aparecem na resposta.
//   - lat validado em [-90, 90], lng em [-180, 180].
//   - name e address limitados a 255 chars cada.

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import { isValidPhone, normalizePhoneForZapi } from '../_shared/zapi-helpers.ts';

const ZAPI_BASE = 'https://api.z-api.io/instances';

interface LocationBody {
  account_id?: string;
  phone?: string;
  lat?: unknown;
  lng?: unknown;
  name?: string;
  address?: string;
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
    let body: LocationBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const accountId = body.account_id?.trim();
    const rawPhone = body.phone?.trim() ?? '';
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const name = body.name?.trim().slice(0, 255) ?? null;
    const address = body.address?.trim().slice(0, 255) ?? null;

    if (!accountId) return jsonResponse(400, { error: 'account_id é obrigatório' });

    // Rejeitar ausente ou não-numérico: Number(undefined) e Number("") viram NaN,
    // mas Number(null) vira 0 — verificar o valor original antes do Number()
    if (body.lat === undefined || body.lat === null || body.lat === '') {
      return jsonResponse(400, { error: 'lat é obrigatório' });
    }
    if (body.lng === undefined || body.lng === null || body.lng === '') {
      return jsonResponse(400, { error: 'lng é obrigatório' });
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return jsonResponse(400, { error: 'lat inválido — deve ser número entre -90 e 90' });
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return jsonResponse(400, { error: 'lng inválido — deve ser número entre -180 e 180' });
    }
    // Rejeitar coordenada nula (0,0) — ponto no Oceano Atlântico sem sentido prático
    if (lat === 0 && lng === 0) {
      return jsonResponse(400, { error: 'Coordenadas inválidas — lat e lng não podem ser ambos zero' });
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
      console.error('zapi-send-location: erro ao buscar conta', { code: accountErr.code });
      return jsonResponse(500, { error: 'Erro ao localizar conta' });
    }
    if (!account) return jsonResponse(404, { error: 'Conta Z-API não encontrada' });
    if (account.status === 'disconnected') {
      return jsonResponse(422, { error: 'Conta desconectada — reconecte antes de enviar' });
    }

    // ── 4. UPSERT do chat ────────────────────────────────────────────────────
    const nowIso = new Date().toISOString();
    const { data: chat, error: chatErr } = await admin
      .from('zapi_chats')
      .upsert(
        { account_id: account.id, phone, updated_at: nowIso },
        { onConflict: 'account_id,phone', ignoreDuplicates: false },
      )
      .select('id')
      .single();

    if (chatErr || !chat) {
      console.error('zapi-send-location: erro ao upsert chat', { code: chatErr?.code });
      return jsonResponse(500, { error: 'Erro ao preparar conversa' });
    }

    // ── 5. Chamada Z-API ────────────────────────────────────────────────────
    // encodeURIComponent nos segmentos de URL (anti-SSRF — Fase 3 lesson learned)
    const url = `${ZAPI_BASE}/${encodeURIComponent(account.instance_id)}/token/${encodeURIComponent(account.instance_token)}/send-location`;

    const zapiBodyObj: Record<string, unknown> = { phone, lat, lng };
    if (name) zapiBodyObj.name = name;
    if (address) zapiBodyObj.address = address;

    let zapiResp: Response;
    try {
      zapiResp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': account.client_token,
        },
        body: JSON.stringify(zapiBodyObj),
      });
    } catch (err) {
      console.error('zapi-send-location: fetch falhou', err instanceof Error ? err.message : '');
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
      console.error('zapi-send-location: Z-API erro', { status: zapiResp.status, detail });
      return jsonResponse(502, { error: `Z-API: ${detail}` });
    }

    const zapiMessageId =
      (zapiBody.messageId as string | undefined) ??
      (zapiBody.id as string | undefined) ??
      (zapiBody.zaapId as string | undefined) ??
      `unknown-${crypto.randomUUID()}`;

    // ── 6. Persiste mensagem outbound ───────────────────────────────────────
    const preview = name ? `📍 ${name}` : '📍 Localização';

    const { error: msgErr } = await admin
      .from('zapi_messages')
      .insert({
        account_id: account.id,
        chat_id: chat.id,
        message_id: zapiMessageId,
        direction: 'outbound',
        body: name ?? null,
        status: 'sent',
        sent_at: nowIso,
        media_type: 'location',
        media_metadata: {
          latitude: lat,
          longitude: lng,
          name: name ?? null,
          address: address ?? null,
        },
      });

    if (msgErr && msgErr.code !== '23505') {
      console.error('zapi-send-location: erro ao persistir mensagem', { code: msgErr.code });
    }

    // ── 7. Atualiza chat ────────────────────────────────────────────────────
    await admin
      .from('zapi_chats')
      .update({ last_message_at: nowIso, last_message_preview: preview, updated_at: nowIso })
      .eq('id', chat.id);

    console.log('zapi-send-location: ok', { caller: callerEmail, callerId, account_id: account.id });
    return jsonResponse(200, { ok: true, message_id: zapiMessageId, chat_id: chat.id });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-send-location crash:', msg);
    return jsonResponse(500, { error: 'Erro interno ao enviar localização' });
  }
});
