// Edge Function: zapi-ai-next-action
//
// Sugere a próxima melhor ação para um contato com base no histórico (C37).
// Persiste em contacts.ai_next_action e ai_next_action_at.
//
// Triple Gate REAL (3 gates independentes):
//   Gate 1 — ai_settings.ai_enabled = true + api_key presente
//   Gate 2 — ai_settings.features.next_best_action (flag GLOBAL)
//   Gate 3 — recursos_config.c37 (flag da CONTA)
//
// Segurança:
//   - Rate-limit: 20 chamadas/min por usuário → 429 se excedido
//   - Cooldown: 60s entre análises do mesmo contato (contacts.ai_next_action_at)
//   - IDOR: contact_id validado contra account_id via zapi_chats JOIN
//   - Prompt injection: conteúdo de terceiros em delimitadores aleatórios
//   - Vazamento de erro: apenas { error: 'provider_error' } sem mensagem crua
//   - Google API key: via header x-goog-api-key (não query string)
//   - Sanitização de logs: strip de chaves antes de logar
//   - Truncamento: observacoes limitado a 500 chars
//   - Validação de saída: tamanho de next_action
//   - Audit log: registra event_type 'ai_next_action' em zapi_audit_log
//
// Referência: RAQ-MAND-EM073 — T85 (Fase 7 Onda A) + Hardening de Segurança

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import {
  tripleGateAI,
  isRateLimited,
  registerAICall,
  sanitizeForLog,
  wrapUserContent,
  antiInjectionInstruction,
  truncateObservacoes,
  validateNextAction,
  buildGoogleUrl,
  googleHeaders,
} from '../_shared/ai-security.ts';

const UUID_REGEX  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COOLDOWN_MS = 60_000; // 60 segundos entre análises do mesmo contato

interface NextActionBody {
  contact_id?: string;
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
    if (await isRateLimited(admin, callerId, 'zapi-ai-next-action')) {
      return jsonResponse(429, { error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' });
    }

    // ── 3. Parse body ────────────────────────────────────────────────────────
    let body: NextActionBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const contactId = body.contact_id?.trim();
    const accountId = body.account_id?.trim();

    if (!contactId || !UUID_REGEX.test(contactId)) {
      return jsonResponse(400, { error: 'contact_id inválido' });
    }
    if (!accountId || !UUID_REGEX.test(accountId)) {
      return jsonResponse(400, { error: 'account_id inválido' });
    }

    // ── 4. Anti-IDOR: valida que contact_id pertence ao account_id ────────────
    // Um contato pertence à conta se existe um zapi_chat vinculando os dois,
    // OU se o próprio contato foi criado nesta instância (verifica via funil/board_items).
    // A verificação via zapi_chats é a mais direta para o contexto de WhatsApp.
    const { data: chatVinculo, error: vinculoErr } = await admin
      .from('zapi_chats')
      .select('id')
      .eq('contact_id', contactId)
      .eq('account_id', accountId)
      .limit(1)
      .maybeSingle();

    if (vinculoErr) {
      console.error('zapi-ai-next-action: erro ao verificar vínculo', vinculoErr.code);
      return jsonResponse(500, { error: 'Erro ao verificar vínculo do contato' });
    }
    if (!chatVinculo) {
      // Nenhum chat desta conta vincula este contato → acesso negado
      return jsonResponse(403, { error: 'Acesso negado: contato não vinculado a esta conta' });
    }

    // ── 5. Busca dados do contato ─────────────────────────────────────────────
    const { data: contact, error: contactErr } = await admin
      .from('contacts')
      .select('id, nome, origem, observacoes, ai_next_action_at')
      .eq('id', contactId)
      .maybeSingle();

    if (contactErr) {
      console.error('zapi-ai-next-action: erro ao buscar contato', contactErr.code);
      return jsonResponse(500, { error: 'Erro ao localizar contato' });
    }
    if (!contact) {
      return jsonResponse(403, { error: 'Contato não encontrado' });
    }

    // ── 6. Cooldown: evita reanálise em < 60s ────────────────────────────────
    if (contact.ai_next_action_at) {
      const lastAt = new Date(contact.ai_next_action_at as string).getTime();
      if (Date.now() - lastAt < COOLDOWN_MS) {
        return jsonResponse(429, { error: 'Análise já realizada recentemente. Aguarde 60 segundos.' });
      }
    }

    // ── 7. Lê recursos_config da conta ───────────────────────────────────────
    const { data: account } = await admin
      .from('zapi_accounts')
      .select('recursos_config')
      .eq('id', accountId)
      .maybeSingle();

    const config = account?.recursos_config as Record<string, boolean> | null;

    // ── 8. Triple Gate REAL: c37 conta + ai_settings.features.next_best_action ─
    const gate = await tripleGateAI(admin, 'c37', config);
    if (gate.skipped) {
      return jsonResponse(200, { skipped: true, reason: gate.reason });
    }

    // ── 9. Registra chamada de IA ────────────────────────────────────────────
    await registerAICall(admin, callerId, 'zapi-ai-next-action');

    // ── 10. Coleta contexto ───────────────────────────────────────────────────

    // Etapa do funil (via board_items)
    let funnelStage = 'não definida';
    const { data: boardItems } = await admin
      .from('board_items')
      .select('stage:board_stages(name)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (boardItems && boardItems.length > 0) {
      const item = boardItems[0] as { stage?: { name?: string } | null };
      funnelStage = item.stage?.name ?? 'não definida';
    }

    // Demandas abertas
    let demandasAbertas = 'nenhuma';
    const { data: demands } = await admin
      .from('demands')
      .select('title, status')
      .eq('contact_id', contactId)
      .neq('status', 'resolvida')
      .order('created_at', { ascending: false })
      .limit(5);
    if (demands && demands.length > 0) {
      demandasAbertas = demands
        .map((d: { title?: string; status?: string }) =>
          `"${String(d.title ?? '').slice(0, 100)}" (${String(d.status ?? '').slice(0, 50)})`)
        .join(', ');
    }

    // Última mensagem WhatsApp + dias sem contato
    let ultimaMensagem = 'nenhuma mensagem registrada';
    let diasSemContato = 0;
    const { data: lastChat } = await admin
      .from('zapi_chats')
      .select('last_message_at, last_message_body')
      .eq('contact_id', contactId)
      .eq('account_id', accountId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1);

    if (lastChat && lastChat.length > 0 && lastChat[0].last_message_at) {
      const lastAt = new Date(lastChat[0].last_message_at);
      diasSemContato = Math.floor((Date.now() - lastAt.getTime()) / 86_400_000);
      const lastBody = lastChat[0].last_message_body
        ? String(lastChat[0].last_message_body).slice(0, 200)
        : null;
      ultimaMensagem = lastBody
        ? `"${lastBody}" (há ${diasSemContato} dia${diasSemContato !== 1 ? 's' : ''})`
        : `contato há ${diasSemContato} dia${diasSemContato !== 1 ? 's' : ''}`;
    }

    // Sanitiza o nome do contato (usado no prompt, mas não é conteúdo de eleitor direto)
    const nomeContato = String(contact.nome ?? 'não informado').slice(0, 100);

    // Observações: conteúdo de terceiros — wrappado em delimitador anti-injection
    const obsRaw = truncateObservacoes(contact.observacoes as string | null);
    const { fenceId: obsFenceId, wrapped: wrappedObs } = wrapUserContent(obsRaw, 'observacoes');
    const { fenceId: msgFenceId, wrapped: wrappedMsg } = wrapUserContent(ultimaMensagem, 'ultima_mensagem');

    // ── 11. Monta prompt separado em system + user ────────────────────────────
    const systemInstruction = `${antiInjectionInstruction(obsFenceId)}
${antiInjectionInstruction(msgFenceId)}

Você é um coordenador de gabinete parlamentar. Analise perfis de eleitores e sugira ações práticas e diretas para a equipe. Escreva UMA sugestão de ação curta e prática (1-2 frases), direta ao ponto, que a equipe pode executar agora. Escreva apenas a sugestão, sem explicações adicionais.`;

    const userContent = `Analise o perfil do eleitor abaixo e sugira a próxima ação concreta:

- Nome: ${nomeContato}
- Etapa no funil político: ${funnelStage}
- Demandas abertas: ${demandasAbertas}
- Última interação WhatsApp: ${wrappedMsg}
- Observações: ${wrappedObs}`;

    // ── 12. Chama provider ────────────────────────────────────────────────────
    const { provider, model, apiKey } = gate;

    let nextAction: string;
    try {
      if (provider === 'openai') {
        nextAction = await callOpenAI(apiKey, model, systemInstruction, userContent);
      } else if (provider === 'google') {
        nextAction = await callGoogle(apiKey, model, systemInstruction, userContent);
      } else {
        nextAction = await callAnthropic(apiKey, model, systemInstruction, userContent);
      }
    } catch (provErr) {
      const msg = provErr instanceof Error ? provErr.message : String(provErr);
      console.error('zapi-ai-next-action: provider error', sanitizeForLog(msg));
      return jsonResponse(200, { error: 'provider_error' });
    }

    if (!nextAction) {
      return jsonResponse(200, { error: 'empty_response' });
    }

    // Valida tamanho da saída
    nextAction = validateNextAction(nextAction);

    // ── 13. Persiste em contacts ──────────────────────────────────────────────
    const { error: updateErr } = await admin
      .from('contacts')
      .update({
        ai_next_action:    nextAction,
        ai_next_action_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (updateErr) {
      console.error('zapi-ai-next-action: erro ao salvar', updateErr.code);
    }

    // ── 14. Audit log ─────────────────────────────────────────────────────────
    await admin
      .from('zapi_audit_log')
      .insert({
        account_id: accountId,
        contact_id: contactId,
        event_type: 'ai_next_action',
        actor_id:   callerId,
        new_value:  { next_action_length: nextAction.length },
      })
      .catch((e: unknown) => {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.warn('zapi-ai-next-action: audit log falhou', sanitizeForLog(errMsg));
      });

    console.log('zapi-ai-next-action: ok', { caller: callerEmail, contactId, provider });

    return jsonResponse(200, { next_action: nextAction, contact_id: contactId });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-ai-next-action crash:', sanitizeForLog(msg));
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
