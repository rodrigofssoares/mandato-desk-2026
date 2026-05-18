// Edge Function: zapi-ai-analyze-chat
//
// Analisa uma conversa WhatsApp com IA e retorna resumo + classificação + sentimento
// (C33 + C35 + C36) em uma única chamada ao provider, minimizando custo.
//
// Triple Gate REAL (3 gates independentes):
//   Gate 1 — ai_settings.ai_enabled = true + api_key presente
//   Gate 2 — ai_settings.features.{resumo_conversa/classificacao_assunto/analise_sentimento} (flag GLOBAL)
//   Gate 3 — recursos_config.{c33/c35/c36} (flag da CONTA)
//   Por recurso: (gate1 && gate2 && gate3). Se nenhum recurso habilitado → skip.
//
// Segurança:
//   - Rate-limit: 20 chamadas/min por usuário → 429 se excedido
//   - Prompt injection: conteúdo do usuário em delimitadores aleatórios
//   - Vazamento de erro: apenas { error: 'provider_error' } sem mensagem crua
//   - Google API key: via header x-goog-api-key (não query string)
//   - Sanitização de logs: strip de chaves antes de logar
//   - Cooldown: 60s entre análises do mesmo chat
//   - Truncamento: transcript limitado a 24k chars
//   - Validação de saída: tamanho de resumo/intencao + enum de sentimento
//
// Referência: RAQ-MAND-EM073 — T79 (Fase 7 Onda A) + Hardening de Segurança

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import {
  isRateLimited,
  registerAICall,
  sanitizeForLog,
  wrapUserContent,
  antiInjectionInstruction,
  buildSafeTranscript,
  validateSentimento,
  validateResumo,
  validateIntencao,
  buildGoogleUrl,
  googleHeaders,
} from '../_shared/ai-security.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COOLDOWN_MS = 60_000; // 60 segundos entre análises do mesmo chat

interface AnalyzeBody {
  chat_id?: string;
  account_id?: string;
}

interface AIResult {
  resumo?: unknown;
  intencao?: unknown;
  sentimento?: unknown;
}

// ── Helpers de chamada ao provider ───────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userContent: string,
): Promise<AIResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      system: systemInstruction,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) {
    const status = res.status;
    await res.text().catch(() => null); // descarta o corpo
    throw new Error(`Anthropic ${status}`);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';
  return parseJsonFromText(text);
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userContent: string,
): Promise<AIResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user',   content: userContent },
      ],
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const status = res.status;
    await res.text().catch(() => null);
    throw new Error(`OpenAI ${status}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  return JSON.parse(text) as AIResult;
}

async function callGoogle(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userContent: string,
): Promise<AIResult> {
  const res = await fetch(buildGoogleUrl(model), {
    method: 'POST',
    headers: googleHeaders(apiKey),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: userContent }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 512 },
    }),
  });

  if (!res.ok) {
    const status = res.status;
    await res.text().catch(() => null);
    throw new Error(`Google ${status}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return parseJsonFromText(text);
}

function parseJsonFromText(text: string): AIResult {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned) as AIResult;
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
    if (await isRateLimited(admin, callerId, 'zapi-ai-analyze-chat')) {
      return jsonResponse(429, { error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' });
    }

    // ── 3. Parse body ────────────────────────────────────────────────────────
    let body: AnalyzeBody;
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
      .select('id, account_id, contact_id, ai_analyzed_at')
      .eq('id', chatId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (chatErr) {
      console.error('zapi-ai-analyze-chat: erro ao buscar chat', chatErr.code);
      return jsonResponse(500, { error: 'Erro ao localizar conversa' });
    }
    if (!chat) {
      return jsonResponse(403, { error: 'Acesso negado ou conversa não encontrada' });
    }

    // ── 5. Cooldown: evita reanálise em < 60s ────────────────────────────────
    if (chat.ai_analyzed_at) {
      const lastAt = new Date(chat.ai_analyzed_at as string).getTime();
      if (Date.now() - lastAt < COOLDOWN_MS) {
        return jsonResponse(429, { error: 'Análise já realizada recentemente. Aguarde 60 segundos.' });
      }
    }

    // ── 6. Lê recursos_config da conta ───────────────────────────────────────
    const { data: account, error: accErr } = await admin
      .from('zapi_accounts')
      .select('recursos_config')
      .eq('id', accountId)
      .maybeSingle();

    if (accErr || !account) {
      return jsonResponse(404, { error: 'Conta não encontrada' });
    }

    const config = account.recursos_config as Record<string, boolean> | null;

    // ── 7. Triple Gate por recurso (c33/c35/c36) ──────────────────────────────
    // Cada recurso é verificado independentemente — (gate1 && gate2 && gate3)
    // Buscamos ai_settings uma única vez e derivamos os 3 resultados.

    const { data: aiSettings, error: aiErr } = await admin
      .from('ai_settings')
      .select('ai_enabled, provider, model, api_key, features')
      .maybeSingle();

    if (aiErr || !aiSettings) {
      return jsonResponse(200, { skipped: true, reason: 'ai_not_configured' });
    }
    if (!aiSettings.ai_enabled) {
      return jsonResponse(200, { skipped: true, reason: 'ai_disabled' });
    }
    if (!aiSettings.api_key) {
      return jsonResponse(200, { skipped: true, reason: 'api_key_missing' });
    }

    const features = aiSettings.features as Record<string, boolean> | null;

    // Avalia cada recurso: flag da conta AND flag global
    const c33 = (config?.['c33'] === true) && (features?.['resumo_conversa'] === true);
    const c35 = (config?.['c35'] === true) && (features?.['classificacao_assunto'] === true);
    const c36 = (config?.['c36'] === true) && (features?.['analise_sentimento'] === true);

    if (!c33 && !c35 && !c36) {
      return jsonResponse(200, { skipped: true, reason: 'feature_disabled_global' });
    }

    // ── 8. Registra chamada de IA (rate-limit tracking) ───────────────────────
    await registerAICall(admin, callerId, 'zapi-ai-analyze-chat');

    // ── 9. Busca mensagens de texto do chat (últimas 50) ──────────────────────
    const { data: messages, error: msgErr } = await admin
      .from('zapi_messages')
      .select('direction, body, sent_at')
      .eq('chat_id', chatId)
      .not('body', 'is', null)
      .in('media_type', ['text', 'chat', null])
      .order('sent_at', { ascending: false })
      .limit(50);

    if (msgErr) {
      console.error('zapi-ai-analyze-chat: erro ao buscar mensagens', msgErr.code);
      return jsonResponse(500, { error: 'Erro ao buscar mensagens' });
    }

    if (!messages || messages.length === 0) {
      return jsonResponse(200, { skipped: true, reason: 'no_messages' });
    }

    // Ordena cronologicamente e constrói transcript seguro (truncado)
    const chronological = [...messages].reverse();
    const rawTranscript = buildSafeTranscript(chronological);

    // ── 10. Anti-prompt injection: envolve transcript em delimitador aleatório ─
    const { fenceId, wrapped: wrappedTranscript } = wrapUserContent(rawTranscript, 'transcript');
    const injection = antiInjectionInstruction(fenceId);

    // ── 11. Monta system instruction e user content separados ─────────────────
    const requestedFields: string[] = [];
    if (c33) requestedFields.push('"resumo": "resumo curto da conversa em 2-3 frases"');
    if (c35) requestedFields.push('"intencao": "classificação do assunto principal (ex: solicitação de asfalto, reclamação de iluminação)"');
    if (c36) requestedFields.push('"sentimento": "um de: positivo, neutro, negativo, urgente"');

    const systemInstruction = `${injection}

Você é um assistente de gabinete parlamentar analisando conversas de WhatsApp entre o gabinete e eleitores. Responda sempre em JSON válido com português brasileiro. Para "sentimento", use SOMENTE: positivo, neutro, negativo, urgente.`;

    const userContent = `Analise a conversa abaixo e retorne APENAS um JSON com os campos:
{
  ${requestedFields.join(',\n  ')}
}

CONVERSA:
${wrappedTranscript}`;

    // ── 12. Chama o provider ───────────────────────────────────────────────────
    const provider = aiSettings.provider as string ?? 'anthropic';
    const model    = aiSettings.model as string ?? 'claude-haiku-4-5';
    const apiKey   = aiSettings.api_key as string;

    let result: AIResult;
    try {
      if (provider === 'openai') {
        result = await callOpenAI(apiKey, model, systemInstruction, userContent);
      } else if (provider === 'google') {
        result = await callGoogle(apiKey, model, systemInstruction, userContent);
      } else {
        result = await callAnthropic(apiKey, model, systemInstruction, userContent);
      }
    } catch (provErr) {
      const msg = provErr instanceof Error ? provErr.message : String(provErr);
      console.error('zapi-ai-analyze-chat: provider error', sanitizeForLog(msg));
      return jsonResponse(200, { error: 'provider_error' });
    }

    // ── 13. Valida e sanitiza saída do LLM ────────────────────────────────────
    const sentimento = validateSentimento(result.sentimento);
    const resumo     = validateResumo(result.resumo);
    const intencao   = validateIntencao(result.intencao);

    // ── 14. Persiste em zapi_chats ────────────────────────────────────────────
    const analyzedAt = new Date().toISOString();
    const updatePayload: Record<string, string | null> = {
      ai_analyzed_at: analyzedAt,
    };
    if (c33 && resumo)     updatePayload.ai_summary   = resumo;
    if (c35 && intencao)   updatePayload.ai_intent    = intencao;
    if (c36 && sentimento) updatePayload.ai_sentiment = sentimento;

    const { error: updateErr } = await admin
      .from('zapi_chats')
      .update(updatePayload)
      .eq('id', chatId);

    if (updateErr) {
      console.error('zapi-ai-analyze-chat: erro ao salvar análise', updateErr.code);
      // Não falha — retorna o resultado mesmo sem persistir
    }

    // ── 15. Registra evento de auditoria ──────────────────────────────────────
    await admin
      .from('zapi_audit_log')
      .insert({
        account_id:  accountId,
        chat_id:     chatId,
        contact_id:  chat.contact_id ?? null,
        event_type:  'ai_analysis',
        actor_id:    callerId,
        new_value: {
          summary:   resumo     ?? null,
          intent:    intencao   ?? null,
          sentiment: sentimento ?? null,
        },
      })
      .catch((e: unknown) => {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.warn('zapi-ai-analyze-chat: audit log falhou', sanitizeForLog(errMsg));
      });

    console.log('zapi-ai-analyze-chat: ok', { caller: callerEmail, chatId, accountId, provider });

    // ── 16. Retorna ao frontend ────────────────────────────────────────────────
    return jsonResponse(200, {
      summary:     c33 ? (resumo     ?? null) : undefined,
      intent:      c35 ? (intencao   ?? null) : undefined,
      sentiment:   c36 ? (sentimento ?? null) : undefined,
      analyzed_at: analyzedAt,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-ai-analyze-chat crash:', sanitizeForLog(msg));
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
