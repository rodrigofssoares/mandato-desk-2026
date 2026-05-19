// Edge Function: zapi-transcribe-audio
//
// Transcreve mensagens de áudio do WhatsApp usando o provider de IA configurado (C38).
// Persiste o texto em zapi_messages.transcription.
//
// Triple Gate REAL (3 gates independentes):
//   Gate 1 — ai_settings.ai_enabled = true + api_key presente
//   Gate 2 — ai_settings.features.transcricao_audio (flag GLOBAL)
//   Gate 3 — recursos_config.c38 (flag da CONTA)
//
// Segurança:
//   - Rate-limit: 20 chamadas/min por usuário → 429 se excedido
//   - media_url: validada contra allowlist de domínios Z-API (rejeita IP privado/link-local)
//   - Content-Length: validado antes de download (teto 20 MB)
//   - Base64: convertido em chunks (evita stack overflow)
//   - Vazamento de erro: apenas { error: 'provider_error' } sem mensagem crua
//   - Google API key: via header x-goog-api-key (não query string)
//   - Sanitização de logs: strip de chaves antes de logar
//   - Audit log: registra event_type 'ai_transcribe' em zapi_audit_log
//
// Referência: RAQ-MAND-EM073 — T83 (Fase 7 Onda A) + Hardening de Segurança

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import {
  tripleGateAI,
  isRateLimited,
  registerAICall,
  sanitizeForLog,
  validateMediaUrl,
  validateAudioContentLength,
  arrayBufferToBase64,
  buildGoogleUrl,
  googleHeaders,
} from '../_shared/ai-security.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TranscribeBody {
  message_id?: string;
  account_id?: string;
}

// ── Transcrição via OpenAI Whisper ────────────────────────────────────────────

async function transcribeWithWhisper(
  apiKey: string,
  audioBlob: Blob,
  filename: string,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, filename);
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const status = res.status;
    await res.text().catch(() => null); // descarta corpo
    throw new Error(`OpenAI Whisper ${status}`);
  }

  const data = await res.json();
  return (data?.text ?? '').trim();
}

// ── Anthropic NÃO suporta transcrição de áudio ───────────────────────────────
// A API Anthropic não aceita áudio via base64 (type: 'document' é apenas para PDF/texto).
// Mantemos a função apenas como documentação do que NÃO fazer.
// O handler detecta provider === 'anthropic' e retorna skipped antes de chegar aqui.

// ── Transcrição via Google Gemini (multimodal) ────────────────────────────────

async function transcribeWithGoogle(
  apiKey: string,
  model: string,
  audioBase64: string,
  mimeType: string,
): Promise<string> {
  const res = await fetch(buildGoogleUrl(model), {
    method: 'POST',
    headers: googleHeaders(apiKey),
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: 'Transcreva o áudio a seguir em português brasileiro. Retorne apenas o texto transcrito.',
            },
            {
              inline_data: {
                mime_type: mimeType || 'audio/ogg',
                data: audioBase64,
              },
            },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const status = res.status;
    await res.text().catch(() => null);
    throw new Error(`Google ${status}`);
  }

  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação ──────────────────────────────────────────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerEmail } = guard;

    // ── 2. Rate-limit ────────────────────────────────────────────────────────
    if (await isRateLimited(admin, callerId, 'zapi-transcribe-audio')) {
      return jsonResponse(429, { error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' });
    }

    // ── 3. Parse body ────────────────────────────────────────────────────────
    let body: TranscribeBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const messageId = body.message_id?.trim();
    const accountId = body.account_id?.trim();

    if (!messageId || !UUID_REGEX.test(messageId)) {
      return jsonResponse(400, { error: 'message_id inválido' });
    }
    if (!accountId || !UUID_REGEX.test(accountId)) {
      return jsonResponse(400, { error: 'account_id inválido' });
    }

    // ── 4. Anti-IDOR: mensagem pertence à conta? ──────────────────────────────
    const { data: message, error: msgErr } = await admin
      .from('zapi_messages')
      .select('id, chat_id, account_id, media_type, media_url, media_mime, transcription')
      .eq('id', messageId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (msgErr) {
      console.error('zapi-transcribe-audio: erro ao buscar mensagem', msgErr.code);
      return jsonResponse(500, { error: 'Erro ao localizar mensagem' });
    }
    if (!message) {
      return jsonResponse(403, { error: 'Acesso negado ou mensagem não encontrada' });
    }

    // ── 5. Lê recursos_config da conta ───────────────────────────────────────
    const { data: account } = await admin
      .from('zapi_accounts')
      .select('recursos_config')
      .eq('id', accountId)
      .maybeSingle();

    const config = account?.recursos_config as Record<string, boolean> | null;

    // ── 6. Triple Gate REAL: c38 conta + ai_settings.features.transcricao_audio
    const gate = await tripleGateAI(admin, 'c38', config);
    if (gate.skipped) {
      return jsonResponse(200, { skipped: true, reason: gate.reason });
    }

    // ── 7. Valida que é áudio com URL ─────────────────────────────────────────
    if (message.media_type !== 'audio') {
      return jsonResponse(422, { error: 'Mensagem não é um áudio' });
    }
    if (!message.media_url) {
      return jsonResponse(422, { error: 'URL do áudio não disponível' });
    }

    // ── 8. Valida URL de mídia (allowlist + anti SSRF) ────────────────────────
    const urlError = validateMediaUrl(message.media_url as string);
    if (urlError) {
      console.warn('zapi-transcribe-audio: URL de mídia rejeitada', urlError);
      return jsonResponse(422, { error: 'URL de mídia não permitida' });
    }

    // ── 9. Cache: já foi transcrita? ──────────────────────────────────────────
    if (message.transcription) {
      return jsonResponse(200, {
        transcription: message.transcription,
        message_id:    messageId,
        cached:        true,
      });
    }

    // ── 10. Registra chamada de IA ───────────────────────────────────────────
    await registerAICall(admin, callerId, 'zapi-transcribe-audio');

    // ── 11. Download do áudio (com validação de Content-Length) ──────────────
    let audioBlob: Blob;
    let mimeType: string;
    try {
      const audioRes = await fetch(message.media_url as string, {
        signal: AbortSignal.timeout(25_000), // 25s para download
      });
      if (!audioRes.ok) {
        return jsonResponse(200, { error: 'audio_download_failed' });
      }

      // Valida tamanho antes de ler o body
      const sizeError = validateAudioContentLength(audioRes);
      if (sizeError) {
        console.warn('zapi-transcribe-audio: áudio muito grande', sizeError);
        return jsonResponse(422, { error: 'Áudio muito grande para transcrição' });
      }

      audioBlob = await audioRes.blob();
      mimeType  = message.media_mime as string ?? audioRes.headers.get('content-type') ?? 'audio/ogg';

      // Validação de tamanho pós-download (fallback se Content-Length ausente)
      if (audioBlob.size > 20 * 1024 * 1024) {
        return jsonResponse(422, { error: 'Áudio muito grande para transcrição' });
      }
    } catch (downloadErr) {
      const msg = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
      console.error('zapi-transcribe-audio: download falhou', sanitizeForLog(msg));
      return jsonResponse(200, { error: 'audio_download_failed' });
    }

    // ── 12. Transcrição via provider ──────────────────────────────────────────
    const { provider, model, apiKey } = gate;

    // Anthropic não suporta transcrição de áudio — retorna skipped antes de gastar créditos
    if (provider === 'anthropic') {
      console.warn('zapi-transcribe-audio: provider anthropic não suporta áudio — skipped');
      return jsonResponse(200, {
        skipped:  true,
        reason:   'provider_unsupported',
        message:  'Transcrição de áudio não disponível para Anthropic. Configure OpenAI ou Google nas configurações de IA.',
      });
    }

    let transcription: string;
    try {
      if (provider === 'openai') {
        const ext = mimeType.includes('ogg') ? '.ogg'
          : mimeType.includes('mp4') || mimeType.includes('mpeg') ? '.mp3'
          : mimeType.includes('webm') ? '.webm'
          : '.ogg';
        transcription = await transcribeWithWhisper(apiKey, audioBlob, `audio${ext}`);
      } else if (provider === 'google') {
        const buffer = await audioBlob.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer); // chunks — sem stack overflow
        transcription = await transcribeWithGoogle(apiKey, model, base64, mimeType);
      } else {
        // Provider desconhecido — retorna skipped com reason claro
        console.warn('zapi-transcribe-audio: provider desconhecido para áudio', provider);
        return jsonResponse(200, {
          skipped: true,
          reason:  'provider_unsupported',
          message: `Transcrição de áudio não suportada para o provider "${provider}". Use OpenAI ou Google.`,
        });
      }
    } catch (provErr) {
      const msg = provErr instanceof Error ? provErr.message : String(provErr);
      console.error('zapi-transcribe-audio: provider error', sanitizeForLog(msg));
      return jsonResponse(200, { error: 'provider_error' });
    }

    if (!transcription) {
      return jsonResponse(200, { error: 'transcription_empty' });
    }

    // ── 13. Persiste transcrição ──────────────────────────────────────────────
    const { error: updateErr } = await admin
      .from('zapi_messages')
      .update({
        transcription,
        transcribed_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (updateErr) {
      console.error('zapi-transcribe-audio: erro ao salvar transcrição', updateErr.code);
    }

    // ── 14. Audit log ─────────────────────────────────────────────────────────
    await admin
      .from('zapi_audit_log')
      .insert({
        account_id: accountId,
        chat_id:    message.chat_id ?? null,
        event_type: 'ai_transcribe',
        actor_id:   callerId,
        new_value:  { transcription_length: transcription.length },
      })
      .catch((e: unknown) => {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.warn('zapi-transcribe-audio: audit log falhou', sanitizeForLog(errMsg));
      });

    console.log('zapi-transcribe-audio: ok', { caller: callerEmail, messageId, provider });

    return jsonResponse(200, { transcription, message_id: messageId });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-transcribe-audio crash:', sanitizeForLog(msg));
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
