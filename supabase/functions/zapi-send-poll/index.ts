// Edge Function: zapi-send-poll
//
// Envia uma enquete WhatsApp via Z-API.
//
// Body:
//   {
//     account_id: uuid,
//     phone: string,
//     question: string,                  // pergunta da enquete (1-255 chars)
//     options: string[],                 // 2-12 opções (1-100 chars cada)
//     allow_multiple_answers?: boolean,  // default false
//   }
//
// Z-API endpoint: /send-text-poll
//   Body: { phone, message, poll_max_options_selected, options }
//
// Reference: RAQ-MAND-EM051 — extensão "pacote completo de mídia".

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import {
  ZAPI_BASE,
  isValidPhone,
  normalizePhoneForZapi,
  truncatePreview,
} from '../_shared/zapi-helpers.ts';

interface SendPollBody {
  account_id?: string;
  phone?: string;
  question?: string;
  options?: string[];
  allow_multiple_answers?: boolean;
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
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerEmail } = guard;

    let body: SendPollBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const accountId = body.account_id?.trim();
    const rawPhone = body.phone?.trim() ?? '';
    const question = body.question?.trim() ?? '';
    const allowMulti = body.allow_multiple_answers === true;
    const optionsRaw = Array.isArray(body.options) ? body.options : [];
    const options = optionsRaw
      .map((o) => (typeof o === 'string' ? o.trim() : ''))
      .filter((o) => o.length > 0);

    if (!accountId) return jsonResponse(400, { error: 'account_id é obrigatório' });
    if (!question) return jsonResponse(400, { error: 'Pergunta é obrigatória' });
    if (question.length > 255) {
      return jsonResponse(400, { error: 'Pergunta excede 255 caracteres' });
    }
    if (options.length < 2 || options.length > 12) {
      return jsonResponse(400, { error: 'Enquete precisa ter entre 2 e 12 opções' });
    }
    if (options.some((o) => o.length > 100)) {
      return jsonResponse(400, { error: 'Cada opção deve ter no máximo 100 caracteres' });
    }
    if (new Set(options).size !== options.length) {
      return jsonResponse(400, { error: 'Opções não podem repetir' });
    }

    const phone = normalizePhoneForZapi(rawPhone);
    if (!isValidPhone(phone)) {
      return jsonResponse(400, { error: 'Telefone inválido' });
    }

    // ── Conta ────────────────────────────────────────────────────────────────
    const { data: account, error: accErr } = await admin
      .from('zapi_accounts')
      .select('id, instance_id, instance_token, client_token, status')
      .eq('id', accountId)
      .maybeSingle<ZapiAccount>();

    if (accErr) {
      console.error('zapi-send-poll: erro buscar conta', accErr.code);
      return jsonResponse(500, { error: 'Erro ao localizar conta' });
    }
    if (!account) return jsonResponse(404, { error: 'Conta não encontrada' });
    if (account.status === 'disconnected') {
      return jsonResponse(422, { error: 'Conta desconectada' });
    }

    // ── Upsert chat ──────────────────────────────────────────────────────────
    const { data: chat, error: chatErr } = await admin
      .from('zapi_chats')
      .upsert(
        { account_id: account.id, phone, updated_at: new Date().toISOString() },
        { onConflict: 'account_id,phone', ignoreDuplicates: false },
      )
      .select('id')
      .single();

    if (chatErr || !chat) {
      console.error('zapi-send-poll: upsert chat falhou', chatErr?.code);
      return jsonResponse(500, { error: 'Erro ao preparar conversa' });
    }

    // ── Z-API call ───────────────────────────────────────────────────────────
    const zapiUrl = `${ZAPI_BASE}/${account.instance_id}/token/${account.instance_token}/send-text-poll`;
    const zapiPayload = {
      phone,
      message: question,
      poll_max_options_selected: allowMulti ? options.length : 1,
      options,
    };

    let zapiResp: Response;
    try {
      zapiResp = await fetch(zapiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': account.client_token,
        },
        body: JSON.stringify(zapiPayload),
      });
    } catch (err) {
      console.error('zapi-send-poll: fetch falhou', err instanceof Error ? err.message : '');
      return jsonResponse(502, { error: 'Falha ao contactar a Z-API' });
    }

    if (zapiResp.status === 429) {
      return jsonResponse(429, { error: 'Limite de envio atingido' });
    }

    let zapiBody: { id?: string; messageId?: string; zaapId?: string; error?: string } = {};
    try {
      zapiBody = await zapiResp.json();
    } catch {
      // sem json
    }

    if (!zapiResp.ok) {
      const detail = zapiBody?.error ?? `HTTP ${zapiResp.status}`;
      console.error('zapi-send-poll: Z-API erro', { status: zapiResp.status, detail });
      return jsonResponse(502, { error: `Z-API: ${detail}` });
    }

    const zapiMessageId =
      zapiBody.messageId ?? zapiBody.id ?? zapiBody.zaapId ?? `unknown-${crypto.randomUUID()}`;

    // ── Persiste mensagem outbound ───────────────────────────────────────────
    const nowIso = new Date().toISOString();
    const preview = `📊 ${truncatePreview(question, 180)}`;

    const { error: msgErr } = await admin
      .from('zapi_messages')
      .insert({
        account_id: account.id,
        chat_id: (chat as { id: string }).id,
        message_id: zapiMessageId,
        direction: 'outbound',
        body: question,
        status: 'sent',
        sent_at: nowIso,
        media_type: 'poll',
        media_metadata: {
          question,
          options,
          allow_multiple_answers: allowMulti,
        },
      });

    if (msgErr && msgErr.code !== '23505') {
      console.error('zapi-send-poll: persist falhou', msgErr.code);
    }

    await admin
      .from('zapi_chats')
      .update({
        last_message_at: nowIso,
        last_message_preview: preview,
        updated_at: nowIso,
      })
      .eq('id', (chat as { id: string }).id);

    console.log('zapi-send-poll: ok', {
      caller: callerEmail,
      callerId,
      account_id: account.id,
    });

    return jsonResponse(200, {
      ok: true,
      message_id: zapiMessageId,
      chat_id: (chat as { id: string }).id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-send-poll crash:', msg);
    return jsonResponse(500, { error: 'Erro interno ao enviar enquete' });
  }
});
