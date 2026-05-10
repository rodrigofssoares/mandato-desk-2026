// Edge Function: zapi-send-media
//
// Envia mídia (imagem, vídeo, áudio, documento) via Z-API. O frontend faz
// upload no bucket Storage zapi-attachments e passa a URL pública aqui.
//
// Body:
//   {
//     account_id: uuid,
//     phone: string,                                // formato livre — normalizado
//     type: 'image' | 'video' | 'audio' | 'document',
//     media_url: string,                            // URL pública (bucket ou externa)
//     caption?: string,                             // imagem/vídeo/documento
//     file_name?: string,                           // documento (obrigatório)
//     mime_type?: string,                           // metadado
//   }
//
// Z-API endpoints despachados:
//   image    → /send-image     { phone, image:    url, caption }
//   video    → /send-video     { phone, video:    url, caption }
//   audio    → /send-audio     { phone, audio:    url }
//   document → /send-document/{ext} { phone, document: url, fileName, caption }
//
// Reference: RAQ-MAND-EM051 — extensão "pacote completo de mídia".

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import {
  ZAPI_BASE,
  extensionFromMime,
  extractExtension,
  isValidPhone,
  normalizePhoneForZapi,
  truncatePreview,
} from '../_shared/zapi-helpers.ts';

type MediaType = 'image' | 'video' | 'audio' | 'document';

interface SendMediaBody {
  account_id?: string;
  phone?: string;
  type?: MediaType;
  media_url?: string;
  caption?: string;
  file_name?: string;
  mime_type?: string;
}

interface ZapiAccount {
  id: string;
  name: string;
  instance_id: string;
  instance_token: string;
  client_token: string;
  status: 'configured' | 'connected' | 'disconnected';
}

const VALID_TYPES: MediaType[] = ['image', 'video', 'audio', 'document'];

function previewForType(type: MediaType, caption?: string | null): string {
  if (caption && caption.trim()) return truncatePreview(caption.trim());
  const labels: Record<MediaType, string> = {
    image: '📷 Imagem',
    video: '🎥 Vídeo',
    audio: '🎙 Áudio',
    document: '📎 Documento',
  };
  return labels[type];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerEmail } = guard;

    let body: SendMediaBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const accountId = body.account_id?.trim();
    const rawPhone = body.phone?.trim() ?? '';
    const type = body.type;
    const mediaUrl = body.media_url?.trim() ?? '';
    const caption = body.caption?.trim() ?? '';
    const fileName = body.file_name?.trim() ?? '';
    const mime = body.mime_type?.trim() ?? '';

    if (!accountId) return jsonResponse(400, { error: 'account_id é obrigatório' });
    if (!type || !VALID_TYPES.includes(type)) {
      return jsonResponse(400, { error: 'type deve ser image, video, audio ou document' });
    }
    if (!mediaUrl) return jsonResponse(400, { error: 'media_url é obrigatório' });
    if (mediaUrl.length > 2048) {
      return jsonResponse(400, { error: 'media_url muito longa (>2048)' });
    }
    if (!/^https?:\/\//i.test(mediaUrl)) {
      return jsonResponse(400, { error: 'media_url precisa ser http(s)' });
    }
    if (caption.length > 1024) {
      return jsonResponse(400, { error: 'caption excede 1024 caracteres' });
    }

    const phone = normalizePhoneForZapi(rawPhone);
    if (!isValidPhone(phone)) {
      return jsonResponse(400, { error: 'Telefone inválido' });
    }

    // ── Conta ────────────────────────────────────────────────────────────────
    const { data: account, error: accErr } = await admin
      .from('zapi_accounts')
      .select('id, name, instance_id, instance_token, client_token, status')
      .eq('id', accountId)
      .maybeSingle<ZapiAccount>();

    if (accErr) {
      console.error('zapi-send-media: erro buscar conta', accErr.code);
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
      console.error('zapi-send-media: upsert chat falhou', chatErr?.code);
      return jsonResponse(500, { error: 'Erro ao preparar conversa' });
    }

    // ── Despacho Z-API ───────────────────────────────────────────────────────
    let zapiUrl: string;
    let zapiPayload: Record<string, unknown>;

    switch (type) {
      case 'image':
        zapiUrl = `${ZAPI_BASE}/${account.instance_id}/token/${account.instance_token}/send-image`;
        zapiPayload = { phone, image: mediaUrl };
        if (caption) zapiPayload.caption = caption;
        break;
      case 'video':
        zapiUrl = `${ZAPI_BASE}/${account.instance_id}/token/${account.instance_token}/send-video`;
        zapiPayload = { phone, video: mediaUrl };
        if (caption) zapiPayload.caption = caption;
        break;
      case 'audio':
        zapiUrl = `${ZAPI_BASE}/${account.instance_id}/token/${account.instance_token}/send-audio`;
        zapiPayload = { phone, audio: mediaUrl };
        break;
      case 'document': {
        if (!fileName) {
          return jsonResponse(400, { error: 'file_name é obrigatório para documento' });
        }
        const ext = extractExtension(fileName) === 'any'
          ? extensionFromMime(mime)
          : extractExtension(fileName);
        zapiUrl = `${ZAPI_BASE}/${account.instance_id}/token/${account.instance_token}/send-document/${ext}`;
        zapiPayload = { phone, document: mediaUrl, fileName };
        if (caption) zapiPayload.caption = caption;
        break;
      }
    }

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
      console.error('zapi-send-media: fetch falhou', err instanceof Error ? err.message : '');
      return jsonResponse(502, { error: 'Falha ao contactar a Z-API' });
    }

    if (zapiResp.status === 429) {
      return jsonResponse(429, { error: 'Limite de envio atingido' });
    }

    let zapiBody: { id?: string; messageId?: string; zaapId?: string; error?: string } = {};
    try {
      zapiBody = await zapiResp.json();
    } catch {
      // sem JSON
    }

    if (!zapiResp.ok) {
      const detail = zapiBody?.error ?? `HTTP ${zapiResp.status}`;
      console.error('zapi-send-media: Z-API erro', { status: zapiResp.status, detail });
      return jsonResponse(502, { error: `Z-API: ${detail}` });
    }

    const zapiMessageId =
      zapiBody.messageId ?? zapiBody.id ?? zapiBody.zaapId ?? `unknown-${crypto.randomUUID()}`;

    // ── Persiste mensagem outbound ───────────────────────────────────────────
    const nowIso = new Date().toISOString();
    const preview = previewForType(type, caption);

    const { error: msgErr } = await admin
      .from('zapi_messages')
      .insert({
        account_id: account.id,
        chat_id: (chat as { id: string }).id,
        message_id: zapiMessageId,
        direction: 'outbound',
        body: caption || null,
        status: 'sent',
        sent_at: nowIso,
        media_type: type,
        media_url: mediaUrl,
        media_mime: mime || null,
        media_filename: fileName || null,
        media_caption: caption || null,
      });

    if (msgErr && msgErr.code !== '23505') {
      console.error('zapi-send-media: persist falhou', msgErr.code);
    }

    await admin
      .from('zapi_chats')
      .update({
        last_message_at: nowIso,
        last_message_preview: preview,
        updated_at: nowIso,
      })
      .eq('id', (chat as { id: string }).id);

    console.log('zapi-send-media: ok', {
      caller: callerEmail,
      callerId,
      account_id: account.id,
      type,
    });

    return jsonResponse(200, {
      ok: true,
      message_id: zapiMessageId,
      chat_id: (chat as { id: string }).id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-send-media crash:', msg);
    return jsonResponse(500, { error: 'Erro interno ao enviar mídia' });
  }
});
