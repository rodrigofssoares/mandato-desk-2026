// Edge Function: zapi-ai-suggest-reply
//
// Gera sugestão de resposta efêmera com IA para uma conversa (C34).
// Não persiste no banco — retorna apenas { suggestion: string } para o frontend.
//
// Triple Gate REAL (3 gates independentes):
//   Gate 1 — ai_settings.ai_enabled = true + api_key presente
//   Gate 2 — ai_settings.features.sugestao_resposta (flag GLOBAL)
//   Gate 3 — recursos_config.c34 (flag da CONTA)
//
// Segurança:
//   - Rate-limit: 20 chamadas/min por usuário → 429 se excedido
//   - Prompt injection: conteúdo do eleitor em delimitadores aleatórios
//   - Vazamento de erro: apenas { error: 'provider_error' } sem mensagem crua
//   - Google API key: via header x-goog-api-key (não query string)
//   - Sanitização de logs: strip de chaves antes de logar
//   - Truncamento: transcript limitado a 24k chars
//   - Audit log: registra event_type 'ai_suggest' em zapi_audit_log
//
// Referência: RAQ-MAND-EM073 — T81 (Fase 7 Onda A) + Hardening de Segurança

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import {
  tripleGateAI,
  isRateLimited,
  registerAICall,
  sanitizeForLog,
  wrapUserContent,
  antiInjectionInstruction,
  buildSafeTranscript,
  buildGoogleUrl,
  googleHeaders,
} from '../_shared/ai-security.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SuggestBody {
  chat_id?: string;
  account_id?: string;
}

// ── Helpers de chamada ao provider ───────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userContent: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      system: systemInstruction,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!res.ok) {
    const status = res.status;
    await res.text().catch(() => null);
    throw new Error(`Anthropic ${status}`);
  }
  const data = await res.json();
  return (data?.content?.[0]?.text ?? '').trim();
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userContent: string,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user',   content: userContent },
      ],
      max_tokens: 256,
    }),
  });
  if (!res.ok) {
    const status = res.status;
    await res.text().catch(() => null);
    throw new Error(`OpenAI ${status}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? '').trim();
}

async function callGoogle(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userContent: string,
): Promise<string> {
  const res = await fetch(buildGoogleUrl(model), {
    method: 'POST',
    headers: googleHeaders(apiKey),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: userContent }] }],
      generationConfig: { maxOutputTokens: 256 },
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
    if (await isRateLimited(admin, callerId, 'zapi-ai-suggest-reply')) {
      return jsonResponse(429, { error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' });
    }

    // ── 3. Parse body ────────────────────────────────────────────────────────
    let body: SuggestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const chatId    = body.chat_id?.trim();
    const accountId = body.account_id?.trim();

    if (!chatId || !UUID_REGEX.test(chatId)) {
      return jsonResponse(400, { error: 'chat_id inválido' });
    }
    if (!accountId || !UUID_REGEX.test(accountId)) {
      return jsonResponse(400, { error: 'account_id inválido' });
    }

    // ── 4. Anti-IDOR: chat pertence à conta? ─────────────────────────────────
    const { data: chat, error: chatErr } = await admin
      .from('zapi_chats')
      .select('id, account_id, contact_id')
      .eq('id', chatId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (chatErr || !chat) {
      return jsonResponse(403, { error: 'Acesso negado ou conversa não encontrada' });
    }

    // ── 5. Lê recursos_config da conta ───────────────────────────────────────
    const { data: account } = await admin
      .from('zapi_accounts')
      .select('recursos_config')
      .eq('id', accountId)
      .maybeSingle();

    const config = account?.recursos_config as Record<string, boolean> | null;

    // ── 6. Triple Gate REAL: c34 conta + ai_settings.features.sugestao_resposta
    const gate = await tripleGateAI(admin, 'c34', config);
    if (gate.skipped) {
      return jsonResponse(200, { skipped: true, reason: gate.reason });
    }

    // ── 7. Registra chamada de IA ────────────────────────────────────────────
    await registerAICall(admin, callerId, 'zapi-ai-suggest-reply');

    // ── 8. Busca mensagens + nome do contato ─────────────────────────────────
    const { data: messages } = await admin
      .from('zapi_messages')
      .select('direction, body, sent_at')
      .eq('chat_id', chatId)
      .not('body', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(20);

    const chronological = [...(messages ?? [])].reverse();

    let contactName = 'eleitor';
    if (chat.contact_id) {
      const { data: contact } = await admin
        .from('contacts')
        .select('nome')
        .eq('id', chat.contact_id)
        .maybeSingle();
      if (contact?.nome) {
        // Trunca nome para evitar injeção via nome longo
        contactName = String(contact.nome).slice(0, 100);
      }
    }

    const rawTranscript = buildSafeTranscript(chronological, contactName);

    const hasText = chronological.some((m) => m.body?.trim());
    if (!hasText) {
      return jsonResponse(200, { skipped: true, reason: 'no_text_messages' });
    }

    // ── 9. Anti-prompt injection ──────────────────────────────────────────────
    const { fenceId, wrapped: wrappedTranscript } = wrapUserContent(rawTranscript, 'transcript');
    const injection = antiInjectionInstruction(fenceId);

    // ── 10. Monta system instruction e user content separados ─────────────────
    const systemInstruction = `${injection}

Você é um assessor de gabinete parlamentar experiente. Responda de forma cordial, objetiva e profissional. Sugira UMA resposta curta (1-3 frases) para o gabinete enviar agora. A resposta deve ser cordial, objetiva e em português brasileiro. Escreva APENAS o texto da resposta sugerida, sem aspas, sem explicações adicionais.`;

    const userContent = `Com base na conversa recente com ${contactName.replace(/[<>"]/g, '')}, sugira a próxima resposta do gabinete.

CONVERSA RECENTE:
${wrappedTranscript}`;

    // ── 11. Chama provider ────────────────────────────────────────────────────
    const { provider, model, apiKey } = gate;

    let suggestion: string;
    try {
      if (provider === 'openai') {
        suggestion = await callOpenAI(apiKey, model, systemInstruction, userContent);
      } else if (provider === 'google') {
        suggestion = await callGoogle(apiKey, model, systemInstruction, userContent);
      } else {
        suggestion = await callAnthropic(apiKey, model, systemInstruction, userContent);
      }
    } catch (provErr) {
      const msg = provErr instanceof Error ? provErr.message : String(provErr);
      console.error('zapi-ai-suggest-reply: provider error', sanitizeForLog(msg));
      return jsonResponse(200, { error: 'provider_error' });
    }

    // ── 12. Audit log ─────────────────────────────────────────────────────────
    await admin
      .from('zapi_audit_log')
      .insert({
        account_id: accountId,
        chat_id:    chatId,
        contact_id: chat.contact_id ?? null,
        event_type: 'ai_suggest',
        actor_id:   callerId,
        new_value:  { suggestion_length: suggestion.length },
      })
      .catch((e: unknown) => {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.warn('zapi-ai-suggest-reply: audit log falhou', sanitizeForLog(errMsg));
      });

    console.log('zapi-ai-suggest-reply: ok', { caller: callerEmail, chatId, provider });

    return jsonResponse(200, { suggestion });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-ai-suggest-reply crash:', sanitizeForLog(msg));
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
