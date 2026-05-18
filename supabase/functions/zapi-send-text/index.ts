// Edge Function: zapi-send-text
//
// Envia uma mensagem de texto via Z-API e persiste outbound em zapi_messages.
// Suporta envio "sem abrir conversa": se o chat (account_id, phone) ainda não
// existe, cria automaticamente e dispara matching de contato pelo trigger T09.
//
// Fluxo:
//   1. Valida JWT (qualquer usuário com perfil ATIVO).
//   2. Lê { account_id, phone, message }.
//   3. Busca conta Z-API (com tokens — RLS bypassado por service_role).
//   4. Recusa se status='disconnected'.
//   5. Normaliza phone pra dígitos (formato Z-API: 5511999999999).
//   6. UPSERT em zapi_chats (find or create por account_id + phone).
//   7. POST https://api.z-api.io/instances/{id}/token/{token}/send-text
//        Header: Client-Token: <client_token>
//        Body:   { phone, message }
//   8. INSERT em zapi_messages com direction=outbound, status=sent, message_id da Z-API.
//   9. UPDATE zapi_chats.last_message_at + last_message_preview.
//   10. Retorna { message_id, chat_id }.
//
// Erros:
//   - 400 mensagem vazia ou phone inválido (sem chamar Z-API).
//   - 404 conta não encontrada.
//   - 422 conta com status=disconnected.
//   - 429 Z-API rate limit (repassa pra UI).
//   - 502 Z-API erro externo.
//   - 500 erro interno (sem vazar detalhes de token).
//
// Segurança:
//   - instance_token e client_token NUNCA aparecem na resposta nem em logs.
//   - body limitado a 4096 chars (espelha CHECK constraint de zapi_messages).
//   - phone validado por regex (somente dígitos após normalização, 10-15 chars).
//   - service_role usado apenas internamente — input do cliente nunca chega ao admin client.
//
// Reference: RAQ-MAND-EM051 — T04 + extensão "envio sem abrir conversa".

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import { isValidPhone, normalizePhoneForZapi } from '../_shared/zapi-helpers.ts';

const ZAPI_BASE = 'https://api.z-api.io/instances';

interface SendBody {
  account_id?: string;
  phone?: string;
  message?: string;
  /** T33: ID Z-API da mensagem a citar (reply). Opcional. */
  quoted_message_id?: string;
}

interface ZapiAccount {
  id: string;
  name: string;
  instance_id: string;
  instance_token: string;
  client_token: string;
  status: 'configured' | 'connected' | 'disconnected';
}

interface ZapiSendResponse {
  // A resposta real da Z-API tem campos id, zaapId, messageId — ordem varia.
  id?: string;
  zaapId?: string;
  messageId?: string;
  // Em erro: { error: string } ou { value: false, ... }
  error?: string;
}

// digitsOnly / normalizePhoneForZapi / isValidPhone vivem em _shared/zapi-helpers.ts
// (fonte única — mesma normalização usada pelo webhook e pelas outras EFs de envio).

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação ─────────────────────────────────────────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerEmail } = guard;

    // ── 2. Parse body ───────────────────────────────────────────────────────
    let body: SendBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const accountId = body.account_id?.trim();
    const rawPhone = body.phone?.trim() ?? '';
    const rawMessage = body.message ?? '';
    const message = rawMessage.trim();
    // T33: campo opcional de reply — se presente, não pode ser vazio
    const quotedId = body.quoted_message_id?.trim() ?? null;

    if (!accountId) return jsonResponse(400, { error: 'account_id é obrigatório' });
    if (!message) return jsonResponse(400, { error: 'Mensagem não pode ser vazia' });
    if (message.length > 4096) {
      return jsonResponse(400, { error: 'Mensagem excede 4096 caracteres' });
    }
    // T33: quoted_message_id presente mas vazio → erro semântico
    if (body.quoted_message_id !== undefined && body.quoted_message_id !== null && !quotedId) {
      return jsonResponse(400, { error: 'quoted_message_id inválido — forneça um ID não-vazio ou omita o campo' });
    }

    const phone = normalizePhoneForZapi(rawPhone);
    if (!isValidPhone(phone)) {
      return jsonResponse(400, {
        error: 'Telefone inválido — informe DDD + número (ex: 11 99999-9999)',
      });
    }

    // ── 3. Busca conta Z-API ────────────────────────────────────────────────
    const { data: account, error: accountErr } = await admin
      .from('zapi_accounts')
      .select('id, name, instance_id, instance_token, client_token, status')
      .eq('id', accountId)
      .maybeSingle<ZapiAccount>();

    if (accountErr) {
      console.error('zapi-send-text: erro ao buscar conta', { code: accountErr.code });
      return jsonResponse(500, { error: 'Erro ao localizar conta' });
    }
    if (!account) return jsonResponse(404, { error: 'Conta Z-API não encontrada' });
    if (account.status === 'disconnected') {
      return jsonResponse(422, { error: 'Conta desconectada — reconecte antes de enviar' });
    }

    // ── 4. UPSERT do chat ────────────────────────────────────────────────────
    // UNIQUE(account_id, phone) garante 1 chat por número/conta.
    // ON CONFLICT DO UPDATE no updated_at é apenas pra obter o id existente
    // (sem alterar last_message_* — isso vem depois do envio).
    const { data: chat, error: chatErr } = await admin
      .from('zapi_chats')
      .upsert(
        { account_id: account.id, phone, updated_at: new Date().toISOString() },
        { onConflict: 'account_id,phone', ignoreDuplicates: false },
      )
      .select('id')
      .single();

    if (chatErr || !chat) {
      console.error('zapi-send-text: erro ao upsert chat', { code: chatErr?.code });
      return jsonResponse(500, { error: 'Erro ao preparar conversa' });
    }

    // ── 5. Chamada Z-API ────────────────────────────────────────────────────
    const url = `${ZAPI_BASE}/${encodeURIComponent(account.instance_id)}/token/${encodeURIComponent(account.instance_token)}/send-text`;

    // T33: body condicional — inclui quoted apenas quando quoted_message_id presente
    const zapiBodyObj: Record<string, unknown> = { phone, message };
    if (quotedId) {
      zapiBodyObj.quoted = { messageId: quotedId };
    }

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
      console.error('zapi-send-text: fetch falhou', err instanceof Error ? err.message : '');
      return jsonResponse(502, { error: 'Falha ao contactar a Z-API' });
    }

    if (zapiResp.status === 429) {
      return jsonResponse(429, {
        error: 'Limite de envio atingido. Aguarde antes de tentar novamente.',
      });
    }

    let zapiBody: ZapiSendResponse = {};
    try {
      zapiBody = await zapiResp.json();
    } catch {
      // Sem JSON válido — segue com objeto vazio
    }

    if (!zapiResp.ok) {
      const detail = zapiBody?.error ?? `HTTP ${zapiResp.status}`;
      console.error('zapi-send-text: Z-API retornou erro', { status: zapiResp.status, detail });
      return jsonResponse(502, { error: `Z-API: ${detail}` });
    }

    const zapiMessageId =
      zapiBody.messageId ?? zapiBody.id ?? zapiBody.zaapId ?? `unknown-${crypto.randomUUID()}`;

    // ── 6. Persiste mensagem outbound ───────────────────────────────────────
    const nowIso = new Date().toISOString();
    const preview = message.length > 200 ? `${message.slice(0, 197)}...` : message;

    const { error: msgErr } = await admin
      .from('zapi_messages')
      .insert({
        account_id: account.id,
        chat_id: chat.id,
        message_id: zapiMessageId,
        direction: 'outbound',
        body: message.slice(0, 4096),
        status: 'sent',
        sent_at: nowIso,
        // T33: persiste quoted_message_id quando reply
        quoted_message_id: quotedId ?? null,
      });

    if (msgErr) {
      // Idempotência: se a Z-API duplicou ou já existe, ignora (DO NOTHING semântico).
      // Caso contrário, loga mas não falha — a mensagem JÁ foi enviada de verdade.
      const isDuplicate = msgErr.code === '23505';
      if (!isDuplicate) {
        console.error('zapi-send-text: erro ao persistir mensagem', { code: msgErr.code });
        // Continua — usuário precisa saber que enviou, mesmo se persistência falhou
      }
    }

    // ── 7. Atualiza chat com última mensagem ────────────────────────────────
    await admin
      .from('zapi_chats')
      .update({
        last_message_at: nowIso,
        last_message_preview: preview,
        updated_at: nowIso,
      })
      .eq('id', chat.id);

    console.log('zapi-send-text: ok', {
      caller: callerEmail,
      callerId,
      account_id: account.id,
      chat_id: chat.id,
    });

    return jsonResponse(200, {
      ok: true,
      message_id: zapiMessageId,
      chat_id: chat.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-send-text crash:', msg);
    return jsonResponse(500, { error: 'Erro interno ao enviar mensagem' });
  }
});
