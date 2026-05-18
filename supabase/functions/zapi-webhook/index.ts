// Edge Function: zapi-webhook
//
// Receives all callback events from Z-API and persists them in the Mandato Desk
// database. Public endpoint (no Supabase auth) — authentication is via the
// account-specific webhook_secret carried in the ?secret= query param.
//
// URL pattern (configure in Z-API):
//   https://<project>.supabase.co/functions/v1/zapi-webhook?account=<account_uuid>&secret=<webhook_secret>
//
// Authentication:
//   O segredo trafega na query string (?secret=...) — a Z-API NÃO suporta
//   headers HTTP customizados em webhooks. O header X-Webhook-Secret também é
//   aceito como fallback (mesma comparação timing-safe), para testes manuais
//   ou outros provedores capazes de enviá-lo.
//
// Z-API event types handled:
//   - ReceivedCallback        → upsert chat + insert inbound message (+ quoted fields)
//   - MessageStatusCallback   → update message status (delivered/read/etc)
//   - DisconnectedCallback    → set zapi_accounts.status = 'disconnected'
//   - ConnectedCallback       → set zapi_accounts.status = 'connected'
//   - EditedMessageCallback   → update edited_body + edited_at in zapi_messages
//   - DeletedMessageCallback  → update deleted_at in zapi_messages
//   - PresenceCallback        → broadcast typing state via Supabase Realtime
//   - PollUpdateMessage (T75) → registra voto de enquete de broadcast em zapi_broadcast_poll_votes
//   - other types             → logged but not processed (ignored gracefully)
//
// Always responds 200 to avoid Z-API retry storms — failures are logged in
// zapi_webhook_log with processing_status='error'.
//
// Security:
//   - Timing-safe HMAC compare on the webhook_secret (CWE-208 mitigation).
//   - Account_id from query MUST exist; payload-claimed instanceId is
//     ignored to prevent IDOR via the body.
//   - Mídia (image/audio/video/document base64) é removida do payload antes
//     de entrar em zapi_webhook_log e nunca entra em zapi_messages.body.
//   - Body truncado a 4096 chars (espelha CHECK constraint).
//   - service_role usado apenas internamente; cliente nunca pode chamar com privilégio.
//
// Reference: RAQ-MAND-EM051 — T02.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizePhoneForZapi } from '../_shared/zapi-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Constant-time string compare — mitiga timing attack no secret check. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Strip media-heavy fields from payload before persisting in webhook_log. */
function stripMediaFromPayload(input: unknown): unknown {
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(stripMediaFromPayload);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const k = key.toLowerCase();
    // Keys that often carry base64 blobs
    if (
      k === 'image' ||
      k === 'audio' ||
      k === 'video' ||
      k === 'document' ||
      k === 'sticker' ||
      k === 'thumbnail' ||
      k === 'mediadata' ||
      k === 'media_data' ||
      k === 'data' && typeof value === 'string' && value.length > 1024
    ) {
      out[key] = '[stripped]';
      continue;
    }
    if (typeof value === 'string' && value.length > 16384) {
      out[key] = `[truncated:${value.length}]`;
      continue;
    }
    out[key] = stripMediaFromPayload(value);
  }
  return out;
}

/** Extract preview text from a Z-API received-message payload. */
interface ZapiPayload {
  type?: string;
  status?: string;
  phone?: string;
  messageId?: string;
  fromMe?: boolean;
  senderName?: string;
  // Nome exibido no chat (usado para persistir whatsapp_name em chats LID).
  // Presente em ReceivedCallback para chats LID e grupos.
  chatName?: string;
  // Flags de descarte — presença/verdade indica payload que NÃO deve gerar chat.
  isGroup?: boolean;
  isNewsletter?: boolean;
  broadcast?: boolean;
  text?: { message?: string };
  image?: { imageUrl?: string; caption?: string; mimeType?: string };
  audio?: { audioUrl?: string; mimeType?: string; seconds?: number; ptt?: boolean };
  video?: { videoUrl?: string; caption?: string; mimeType?: string; seconds?: number };
  document?: { documentUrl?: string; fileName?: string; caption?: string; mimeType?: string };
  sticker?: { stickerUrl?: string; mimeType?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  contact?: { displayName?: string; vCard?: string };
  poll?: { name?: string; options?: Array<string | { name?: string }> };
  // Reação do WhatsApp — payload confirmado na documentação Z-API:
  // https://developer.z-api.io/webhooks/on-message-received-examples (seção "Reação")
  // Formato real do evento ReceivedCallback com reação:
  // { type: "ReceivedCallback", messageId: "...", phone: "...", fromMe: false,
  //   senderName: "...",
  //   reaction: { value: "❤️", time: 1651878681150, reactionBy: "554499999999",
  //     referencedMessage: { messageId: "3EB0796DC6B777C0C7CD", fromMe: true,
  //                          phone: "...", participant: null } } }
  // Reação removida: reaction.value === "" (string vazia)
  reaction?: {
    value?: string;
    time?: number;
    reactionBy?: string;
    referencedMessage?: {
      messageId?: string;
      fromMe?: boolean;
      phone?: string;
      participant?: string | null;
    };
  };
  // T32: quoted message (reply) — presente em ReceivedCallback quando há citação
  quoted?: {
    messageId?: string;
    body?: string;
    type?: string;
  };
  // T32: EditedMessageCallback — campos de edição
  // Formato: { type: "EditedMessageCallback", messageId: "<original>", text: { message: "<novo>" } }
  // (campo 'text' já presente na interface acima)
  // T32: DeletedMessageCallback — campo alternativo para messageId apagado
  deletedMessageId?: string;
  // T40: PresenceCallback — estado de presença/digitando
  state?: string;
  [key: string]: unknown;
}

/**
 * Sentinel lançado por handleReceivedMessage quando o payload deve ser
 * descartado intencionalmente (grupo, newsletter, broadcast).
 * O dispatcher captura antes do catch genérico e loga 'ignored' no audit log.
 */
class IgnoredPayload extends Error {
  public readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'IgnoredPayload';
    this.reason = reason;
  }
}

type MediaKind =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'poll'
  | 'location'
  | 'contact'
  | 'reaction'
  | 'unknown';

interface MediaExtract {
  kind: MediaKind;
  body: string | null;        // texto/caption (vai pra body e media_caption)
  url: string | null;
  mime: string | null;
  filename: string | null;
  caption: string | null;
  metadata: Record<string, unknown> | null;
  preview: string;
}

function extractMedia(payload: ZapiPayload): MediaExtract {
  // Texto puro
  if (payload.text?.message) {
    const text = String(payload.text.message).slice(0, 4096);
    return {
      kind: 'text',
      body: text,
      url: null,
      mime: null,
      filename: null,
      caption: null,
      metadata: null,
      preview: text.length > 200 ? `${text.slice(0, 197)}...` : text,
    };
  }

  // Imagem
  if (payload.image?.imageUrl) {
    const caption = payload.image.caption?.slice(0, 1024) ?? null;
    return {
      kind: 'image',
      body: caption,
      url: String(payload.image.imageUrl).slice(0, 2048),
      mime: payload.image.mimeType ?? 'image/jpeg',
      filename: null,
      caption,
      metadata: null,
      preview: caption ? `📷 ${caption.slice(0, 180)}` : '📷 Imagem',
    };
  }

  // Áudio
  if (payload.audio?.audioUrl) {
    return {
      kind: 'audio',
      body: null,
      url: String(payload.audio.audioUrl).slice(0, 2048),
      mime: payload.audio.mimeType ?? 'audio/ogg',
      filename: null,
      caption: null,
      metadata: {
        seconds: payload.audio.seconds ?? null,
        ptt: payload.audio.ptt ?? false,
      },
      preview: '🎙 Áudio',
    };
  }

  // Vídeo
  if (payload.video?.videoUrl) {
    const caption = payload.video.caption?.slice(0, 1024) ?? null;
    return {
      kind: 'video',
      body: caption,
      url: String(payload.video.videoUrl).slice(0, 2048),
      mime: payload.video.mimeType ?? 'video/mp4',
      filename: null,
      caption,
      metadata: { seconds: payload.video.seconds ?? null },
      preview: caption ? `🎥 ${caption.slice(0, 180)}` : '🎥 Vídeo',
    };
  }

  // Documento
  if (payload.document?.documentUrl) {
    const caption = payload.document.caption?.slice(0, 1024) ?? null;
    const filename = payload.document.fileName?.slice(0, 255) ?? null;
    return {
      kind: 'document',
      body: caption,
      url: String(payload.document.documentUrl).slice(0, 2048),
      mime: payload.document.mimeType ?? 'application/octet-stream',
      filename,
      caption,
      metadata: null,
      preview: filename ? `📎 ${filename}` : '📎 Documento',
    };
  }

  // Sticker
  if (payload.sticker?.stickerUrl) {
    return {
      kind: 'sticker',
      body: null,
      url: String(payload.sticker.stickerUrl).slice(0, 2048),
      mime: payload.sticker.mimeType ?? 'image/webp',
      filename: null,
      caption: null,
      metadata: null,
      preview: '🟣 Figurinha',
    };
  }

  // Localização
  if (payload.location && (payload.location.latitude !== undefined || payload.location.longitude !== undefined)) {
    return {
      kind: 'location',
      body: payload.location.name ?? null,
      url: null,
      mime: null,
      filename: null,
      caption: null,
      metadata: {
        latitude: payload.location.latitude,
        longitude: payload.location.longitude,
        name: payload.location.name ?? null,
        address: payload.location.address ?? null,
      },
      preview: payload.location.name
        ? `📍 ${String(payload.location.name).slice(0, 180)}`
        : '📍 Localização',
    };
  }

  // Contato (vCard)
  if (payload.contact?.displayName || payload.contact?.vCard) {
    const display = payload.contact.displayName ?? 'Contato';
    return {
      kind: 'contact',
      body: display,
      url: null,
      mime: 'text/vcard',
      filename: null,
      caption: null,
      metadata: {
        displayName: payload.contact.displayName ?? null,
        vCard: payload.contact.vCard ?? null,
      },
      preview: `👤 ${display.slice(0, 180)}`,
    };
  }

  // Enquete
  if (payload.poll?.name && Array.isArray(payload.poll.options)) {
    const question = String(payload.poll.name).slice(0, 255);
    const options = payload.poll.options
      .map((o) => (typeof o === 'string' ? o : o?.name ?? ''))
      .filter((s) => s.length > 0)
      .map((s) => s.slice(0, 100));
    return {
      kind: 'poll',
      body: question,
      url: null,
      mime: null,
      filename: null,
      caption: null,
      metadata: { question, options },
      preview: `📊 ${question.slice(0, 180)}`,
    };
  }

  // Reação do WhatsApp — branch ANTES do fallback 'unknown'
  // Payload confirmado na doc Z-API (seção on-message-received-examples, tipo "Reação").
  // `reaction.value` vazio ("") indica remoção da reação — gravado como emoji: ''.
  if (payload.reaction !== undefined) {
    // Fix CWE-770: coerção + truncamento alinhados ao padrão dos outros branches
    const emoji = String(payload.reaction.value ?? '').slice(0, 64);
    const reactionMessageId = payload.reaction.referencedMessage?.messageId !== undefined
      ? String(payload.reaction.referencedMessage.messageId).slice(0, 255)
      : null;
    const reactionBy = payload.reaction.reactionBy !== undefined
      ? String(payload.reaction.reactionBy).slice(0, 64)
      : null;
    const reactionTime = typeof payload.reaction.time === 'number' ? payload.reaction.time : null;
    const preview = emoji ? `${emoji} Reação` : 'Reação removida';
    return {
      kind: 'reaction',
      body: null,  // reações não têm corpo de texto — não exibir "[mensagem vazia]"
      url: null,
      mime: null,
      filename: null,
      caption: null,
      metadata: {
        emoji,
        reaction_message_id: reactionMessageId,
        reaction_by: reactionBy,
        reaction_time: reactionTime,
        // Whitelist explícita dos campos conhecidos — evita gravar campos inesperados do payload
        _raw_reaction: {
          value: payload.reaction.value,
          time: payload.reaction.time,
          reactionBy: payload.reaction.reactionBy,
          referencedMessage: payload.reaction.referencedMessage,
        },
      },
      preview,
    };
  }

  return {
    kind: 'unknown',
    body: null,
    url: null,
    mime: null,
    filename: null,
    caption: null,
    metadata: null,
    preview: '[Mensagem]',
  };
}

interface AccountRow {
  id: string;
  webhook_secret: string;
  status: 'configured' | 'connected' | 'disconnected';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    console.error('zapi-webhook: env ausente');
    return jsonResponse(500, { error: 'Configuração do servidor incompleta' });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. Extrai account_id da query string ──────────────────────────────────
  const reqUrl = new URL(req.url);
  const accountId = reqUrl.searchParams.get('account')?.trim() ?? '';

  // ── 2. Lê payload (defensivo: pode vir vazio em ping/health checks) ───────
  let payloadRaw: unknown = {};
  try {
    payloadRaw = await req.json();
  } catch {
    // Z-API às vezes manda OPTIONS-like ping sem body — aceita
  }
  const payload = (payloadRaw ?? {}) as ZapiPayload;
  const eventType = String(payload.type ?? 'unknown');

  // ── 3. Conta válida? ──────────────────────────────────────────────────────
  if (!accountId) {
    // Sem account na URL — log com account_id=NULL e processing_status=error
    await admin.from('zapi_webhook_log').insert({
      account_id: null,
      event_type: eventType,
      payload: stripMediaFromPayload(payload),
      processing_status: 'error',
      error_detail: 'Query param ?account=<uuid> ausente',
    });
    return jsonResponse(200, { ok: false, reason: 'missing_account' });
  }

  const { data: account, error: accountErr } = await admin
    .from('zapi_accounts')
    .select('id, webhook_secret, status')
    .eq('id', accountId)
    .maybeSingle<AccountRow>();

  if (accountErr || !account) {
    await admin.from('zapi_webhook_log').insert({
      account_id: null,
      event_type: eventType,
      payload: stripMediaFromPayload(payload),
      processing_status: 'error',
      error_detail: `Conta ${accountId} não encontrada`,
    });
    return jsonResponse(200, { ok: false, reason: 'account_not_found' });
  }

  // ── 4. Secret check (timing-safe) ────────────────────────────────────────
  // A Z-API NÃO permite configurar headers HTTP customizados em webhooks — a
  // configuração dela só aceita uma URL. Por isso o segredo trafega na query
  // string (?secret=...). O header X-Webhook-Secret continua aceito como
  // fallback para clientes capazes de enviá-lo (testes manuais, outros provedores).
  // Query string é o mecanismo primário (a Z-API só consegue enviar por aqui);
  // o header X-Webhook-Secret é o fallback legado para testes manuais.
  const providedSecret =
    reqUrl.searchParams.get('secret')?.trim() ??
    req.headers.get('x-webhook-secret') ??
    '';
  if (!timingSafeEqual(providedSecret, account.webhook_secret)) {
    await admin.from('zapi_webhook_log').insert({
      account_id: account.id,
      event_type: eventType,
      payload: stripMediaFromPayload(payload),
      processing_status: 'error',
      error_detail: 'webhook_secret inválido (verifique ?secret= na URL ou o header X-Webhook-Secret)',
    });
    // 200 mesmo em invalid secret pra não dar feedback de "tem account válido aqui"
    return jsonResponse(200, { ok: false, reason: 'invalid_secret' });
  }

  // ── 5. Despacho por tipo de evento ───────────────────────────────────────
  let processingStatus: 'processed' | 'error' | 'ignored' = 'processed';
  let errorDetail: string | null = null;

  try {
    switch (eventType) {
      case 'ReceivedCallback':
      case 'MessageReceived':
      case 'message': {
        await handleReceivedMessage(admin, account.id, payload);
        break;
      }
      case 'MessageStatusCallback':
      case 'status': {
        await handleStatusUpdate(admin, account.id, payload);
        break;
      }
      case 'DisconnectedCallback': {
        await admin.from('zapi_accounts').update({ status: 'disconnected' }).eq('id', account.id);
        break;
      }
      case 'ConnectedCallback': {
        await admin.from('zapi_accounts').update({ status: 'connected' }).eq('id', account.id);
        break;
      }
      // T32: edição e exclusão de mensagem
      case 'EditedMessageCallback': {
        await handleEditedMessage(admin, account.id, payload);
        break;
      }
      case 'DeletedMessageCallback': {
        await handleDeletedMessage(admin, account.id, payload);
        break;
      }
      // T40: presença/digitando (efêmero — broadcast Realtime, sem persistência)
      case 'PresenceCallback': {
        await handlePresenceCallback(admin, account.id, payload);
        processingStatus = 'ignored'; // metadado efêmero, não gera dados persistidos
        break;
      }
      // T75 (Fase 6 Onda B): voto de enquete de broadcast
      case 'PollUpdateMessage':
      case 'pollUpdateMessage': {
        await handlePollVote(admin, account.id, payload);
        break;
      }
      default: {
        // Tipo desconhecido — apenas loga, sem erro
        processingStatus = 'ignored';
        break;
      }
    }
  } catch (err) {
    if (err instanceof IgnoredPayload) {
      // Payload descartado intencionalmente (grupo/newsletter/broadcast) — não é erro.
      processingStatus = 'ignored';
      errorDetail = null;
    } else {
      processingStatus = 'error';
      errorDetail = err instanceof Error ? err.message : String(err);
      console.error('zapi-webhook: erro ao processar', { type: eventType, detail: errorDetail });
    }
  }

  // ── 6. Log de auditoria sempre ───────────────────────────────────────────
  await admin.from('zapi_webhook_log').insert({
    account_id: account.id,
    event_type: eventType,
    payload: stripMediaFromPayload(payload),
    processing_status: processingStatus,
    error_detail: errorDetail,
  });

  return jsonResponse(200, {
    ok: processingStatus === 'processed',
    ...(processingStatus === 'ignored' ? { reason: 'ignored_group' } : {}),
  });
});

// ─── Helpers de processamento ────────────────────────────────────────────────

async function handleReceivedMessage(
  admin: ReturnType<typeof createClient>,
  accountId: string,
  payload: ZapiPayload,
): Promise<void> {
  // ── Guard de grupo/newsletter/broadcast ───────────────────────────────────
  // Executado ANTES de qualquer normalização de phone.
  // Lança IgnoredPayload para que o dispatcher registre 'ignored' no audit log
  // sem criar registros em zapi_chats ou zapi_messages.
  if (payload.isGroup === true || payload.isNewsletter === true || payload.broadcast === true) {
    throw new IgnoredPayload('grupo_newsletter_ou_broadcast');
  }

  // Normalização canônica (com 9º dígito) — mesma das EFs de envio, pra que
  // mensagem recebida e enviada caiam no MESMO chat (UNIQUE account_id,phone).
  const phone = normalizePhoneForZapi(String(payload.phone ?? ''));
  if (!phone || phone.length < 10) {
    throw new Error('phone ausente ou inválido');
  }

  const messageId = String(payload.messageId ?? '');
  if (!messageId) {
    throw new Error('messageId ausente');
  }

  const fromMe = Boolean(payload.fromMe);
  const direction = fromMe ? 'outbound' : 'inbound';
  const media = extractMedia(payload);
  const nowIso = new Date().toISOString();

  // Detecta se o phone é um identificador LID (não é telefone real).
  // LIDs contêm '@lid' e representam contatos cujo nome está em chatName/senderName.
  const isLidPhone = String(payload.phone ?? '').includes('@lid');

  // whatsapp_name: só populado para chats LID; telefones normais ficam NULL.
  const whatsappName = isLidPhone
    ? ((payload.chatName ?? payload.senderName ?? null) as string | null)
      ?.slice(0, 255) ?? null
    : null;

  // Upsert chat — whatsapp_name só é incluído para chats LID (onde temos o nome
  // real do contato). Para telefones normais o campo é omitido do objeto de upsert,
  // evitando sobrescrever um nome existente com NULL em caso de conflito.
  const upsertData: Record<string, unknown> = {
    account_id: accountId,
    phone,
    updated_at: nowIso,
  };
  if (isLidPhone) {
    upsertData.whatsapp_name = whatsappName;
  }

  const { data: chat, error: chatErr } = await admin
    .from('zapi_chats')
    .upsert(upsertData, { onConflict: 'account_id,phone' })
    .select('id, unread_count')
    .single();

  if (chatErr || !chat) {
    throw new Error(`upsert chat falhou: ${chatErr?.message ?? 'sem dado'}`);
  }

  // T32: extrair campos de quoted (reply) se presentes
  // quoted.body truncado a 500 chars conforme backlog (preview seguro)
  const quotedMessageId = payload.quoted?.messageId
    ? String(payload.quoted.messageId).slice(0, 255)
    : null;
  const quotedBody = payload.quoted?.body !== undefined
    ? String(payload.quoted.body).slice(0, 500)
    : null;
  const quotedType = payload.quoted?.type
    ? String(payload.quoted.type).slice(0, 64)
    : null;

  // Insert mensagem (idempotente via UNIQUE(message_id, account_id))
  const { error: msgErr } = await admin.from('zapi_messages').insert({
    account_id: accountId,
    chat_id: (chat as { id: string }).id,
    message_id: messageId,
    direction,
    body: media.body,
    status: 'sent',
    sent_at: nowIso,
    media_type: media.kind,
    media_url: media.url,
    media_mime: media.mime,
    media_filename: media.filename,
    media_caption: media.caption,
    media_metadata: media.metadata,
    // T32: campos de quoted message (nullable — presentes apenas em replies)
    quoted_message_id: quotedMessageId,
    quoted_body: quotedBody,
    quoted_type: quotedType,
  });

  if (msgErr && msgErr.code !== '23505') {
    // 23505 = duplicate (idempotência) — qualquer outro erro propaga
    throw new Error(`insert message falhou: ${msgErr.message}`);
  }

  // Atualiza last_message_at + preview e incrementa unread_count se for inbound.
  // Reações NÃO incrementam: são confirmações sobre mensagem existente, não nova mensagem a ler.
  const newUnread = direction === 'inbound' && media.kind !== 'reaction'
    ? (((chat as { unread_count: number }).unread_count ?? 0) + 1)
    : ((chat as { unread_count: number }).unread_count ?? 0);

  await admin
    .from('zapi_chats')
    .update({
      last_message_at: nowIso,
      last_message_preview: media.preview,
      unread_count: newUnread,
      updated_at: nowIso,
    })
    .eq('id', (chat as { id: string }).id);
}

async function handleStatusUpdate(
  admin: ReturnType<typeof createClient>,
  accountId: string,
  payload: ZapiPayload,
): Promise<void> {
  const messageId = String(payload.messageId ?? '');
  if (!messageId) return; // sem id, nada a fazer

  const rawStatus = String(payload.status ?? '').toUpperCase();
  // Z-API: SENT, DELIVERED, READ, PLAYED, VIEWED, FAILED
  const statusMap: Record<string, 'sent' | 'delivered' | 'read' | 'error'> = {
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
    PLAYED: 'read',
    VIEWED: 'read',
    FAILED: 'error',
  };
  const newStatus = statusMap[rawStatus];
  if (!newStatus) return;

  await admin
    .from('zapi_messages')
    .update({ status: newStatus })
    .eq('account_id', accountId)
    .eq('message_id', messageId);
}

// ─── T32: EditedMessageCallback ───────────────────────────────────────────────

async function handleEditedMessage(
  admin: ReturnType<typeof createClient>,
  accountId: string,
  payload: ZapiPayload,
): Promise<void> {
  // Formato Z-API: { type: "EditedMessageCallback", messageId: "<original>",
  //   text: { message: "<novo conteúdo>" } }
  const messageId = String(payload.messageId ?? '');
  if (!messageId) return; // sem id → sem-op silencioso

  const newText = payload.text?.message;
  if (typeof newText !== 'string') return; // sem texto → sem-op

  await admin
    .from('zapi_messages')
    .update({
      edited_body: String(newText).slice(0, 4096),
      edited_at: new Date().toISOString(),
    })
    .eq('account_id', accountId)
    .eq('message_id', messageId);
  // Edição é legítima tanto para inbound (eleitor editou) quanto outbound (operador editou).
  // Proteção contra forja de webhook é responsabilidade do webhook_secret — não filtrar direção.
  // 0 linhas afetadas = messageId inexistente nesta conta → silencioso (sem-op T32)
}

// ─── T32: DeletedMessageCallback ─────────────────────────────────────────────

async function handleDeletedMessage(
  admin: ReturnType<typeof createClient>,
  accountId: string,
  payload: ZapiPayload,
): Promise<void> {
  // Formato Z-API: { type: "DeletedMessageCallback", messageId: "<apagada>" }
  // Versões antigas podem usar deletedMessageId — usar defensivamente ambos.
  const messageId =
    String(payload.messageId ?? payload.deletedMessageId ?? '');
  if (!messageId) return;

  await admin
    .from('zapi_messages')
    .update({
      deleted_at: new Date().toISOString(),
      // edited_body NÃO é alterado — body original preservado para auditoria
    })
    .eq('account_id', accountId)
    .eq('message_id', messageId);
}

// ─── T40: PresenceCallback ────────────────────────────────────────────────────

async function handlePresenceCallback(
  admin: ReturnType<typeof createClient>,
  accountId: string,
  payload: ZapiPayload,
): Promise<void> {
  // Formato Z-API: { type: "PresenceCallback", phone: "...", state: "composing"|"paused"|... }
  const phone = normalizePhoneForZapi(String(payload.phone ?? ''));
  if (!phone || phone.length < 10) {
    console.log('zapi-webhook: PresenceCallback com phone inválido — ignorado');
    return;
  }

  // Whitelist de estados permitidos — evita XSS-via-realtime e spoof de valor arbitrário
  const ALLOWED_STATES = new Set(['composing', 'recording', 'paused', 'available', 'unavailable']);
  const rawState = String(payload.state ?? '');
  const safeState = ALLOWED_STATES.has(rawState) ? rawState : 'unavailable';

  // Buscar o chat_id pelo phone + account_id (igual ao handleReceivedMessage)
  const { data: chat } = await admin
    .from('zapi_chats')
    .select('id')
    .eq('account_id', accountId)
    .eq('phone', phone)
    .maybeSingle<{ id: string }>();

  if (!chat) {
    // Contato sem chat cadastrado → ignorar silenciosamente
    return;
  }

  const chatId = chat.id;
  const isTyping = safeState === 'composing' || safeState === 'recording';
  const eventName = isTyping ? 'typing' : 'stopped-typing';

  // Broadcast via Supabase Realtime REST API — sem persistir no banco
  // POST {SUPABASE_URL}/realtime/v1/api/broadcast

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return;

  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `typing-${chatId}`,
            event: eventName,
            payload: { state: safeState, chatId }, // phone omitido: não necessário para exibição e evita vazar telefone de terceiro
          },
        ],
      }),
    });
  } catch (err) {
    // Falha no broadcast não deve derrubar o webhook
    console.error('zapi-webhook: falha ao fazer broadcast de typing', err instanceof Error ? err.message : '');
  }
}

// ─── T75 (Fase 6 Onda B): PollUpdateMessage — voto de enquete de broadcast ────
// ALTA-6: voto só conta se o phone está em zapi_broadcast_targets com status='enviado'
// para um broadcast tipo enquete. Upsert com onConflict='broadcast_id,phone'
// (1 voto por pessoa — último voto vence). index único alterado na migration 078.

async function handlePollVote(
  admin: ReturnType<typeof createClient>,
  accountId: string,
  payload: ZapiPayload,
): Promise<void> {
  // Formato Z-API (estrutura defensiva — pode variar por versão):
  // { type: "PollUpdateMessage", phone: "5511...", poll: { name: "Pergunta", options: [...] },
  //   selectedOptions?: ["Opção escolhida"], pollUpdate?: { selectedOptions: [...] } }
  const phone = normalizePhoneForZapi(String(payload.phone ?? ''));
  if (!phone || phone.length < 10) {
    console.log('zapi-webhook: PollUpdateMessage com phone inválido — ignorado');
    return;
  }

  // Extrai opção votada — diferentes versões da Z-API usam campos diferentes
  const rawPayload = payload as Record<string, unknown>;
  let optionVoted: string | null = null;

  // Tenta pollUpdate.selectedOptions (versão nova)
  const pollUpdate = rawPayload.pollUpdate as Record<string, unknown> | undefined;
  if (pollUpdate && Array.isArray(pollUpdate.selectedOptions) && pollUpdate.selectedOptions.length > 0) {
    optionVoted = String(pollUpdate.selectedOptions[0]).slice(0, 255);
  }

  // Fallback: selectedOptions direto no payload
  if (!optionVoted && Array.isArray(rawPayload.selectedOptions) && (rawPayload.selectedOptions as unknown[]).length > 0) {
    optionVoted = String((rawPayload.selectedOptions as unknown[])[0]).slice(0, 255);
  }

  if (!optionVoted) {
    console.log('zapi-webhook: PollUpdateMessage sem opção selecionada — ignorado');
    return;
  }

  // ── ALTA-6: verifica que o phone está em zapi_broadcast_targets com status='enviado' ──
  // Associa ao broadcast correto via o target — evita associação ao "mais recente" sem cruzar o phone.
  // Também evita que votes de enquetes avulsas (PollDialog) sejam confundidos com votos de broadcast.

  // 1. Busca os IDs de enquetes ativas desta conta ANTES de usar em .in()
  const { data: enquetes, error: enquetesError } = await admin
    .from('zapi_broadcasts')
    .select('id')
    .eq('account_id', accountId)
    .eq('tipo', 'enquete')
    .in('status', ['enviando', 'concluido']);

  if (enquetesError) {
    console.error('zapi-webhook: erro ao buscar enquetes da conta', enquetesError.message);
    // Propaga erro para que o dispatcher registre processing_status='error'
    throw new Error(`erro ao buscar enquetes: ${enquetesError.message}`);
  }

  const enqueteIds = (enquetes ?? []).map((e: { id: string }) => e.id);
  if (enqueteIds.length === 0) {
    // Nenhuma enquete ativa para esta conta — voto não pode ser associado
    console.log('zapi-webhook: PollUpdateMessage — sem enquetes ativas para esta conta', { accountId });
    return;
  }

  const { data: target } = await admin
    .from('zapi_broadcast_targets')
    .select('broadcast_id, contact_id, phone')
    .eq('phone', phone)
    .eq('status', 'enviado')
    .in('broadcast_id', enqueteIds)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ broadcast_id: string; contact_id: string | null; phone: string }>();

  if (!target) {
    // Phone não encontrado entre targets enviados de enquetes desta conta — ignorar
    console.log('zapi-webhook: PollUpdateMessage — phone não está nos targets enviados de enquete desta conta', { phone, accountId });
    return;
  }

  // Upsert com onConflict='broadcast_id,phone' — 1 voto por pessoa, último voto vence
  // (migration 078 criou o índice único correto)
  const { error: voteError } = await admin
    .from('zapi_broadcast_poll_votes')
    .upsert(
      {
        broadcast_id: target.broadcast_id,
        contact_id: target.contact_id ?? null,
        phone,
        option_voted: optionVoted,
        received_at: new Date().toISOString(),
      },
      {
        onConflict: 'broadcast_id,phone',
        ignoreDuplicates: false, // atualiza option_voted (último voto vence)
      },
    );

  if (voteError) {
    console.error('zapi-webhook: erro ao registrar voto de enquete:', voteError.message);
  } else {
    console.log(`zapi-webhook: voto registrado — broadcast ${target.broadcast_id}, phone ${phone}, opção "${optionVoted}"`);
  }
}
