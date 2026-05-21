// Edge Function: ai-agent-chat
//
// Função principal do agente de chat de IA do Mandato Desk 2026.
// Recebe mensagem do usuário, monta contexto (system_prompt + anexos + histórico),
// chama o provider configurado, persiste resultado e retorna resposta.
//
// POST { session_id: UUID|null, message: string, model_id?: string }
// → { reply, session_id, message_id, model_used, tokens: {...}, cost_brl }
//
// Validações (em ordem):
//   1. JWT + perfil ATIVO
//   2. Carrega agente + is_active
//   3. RBAC: secao 'agente_ia' / pode_ver = true
//   4. Budget global (hard cap 100%)
//   5. Cap diário de mensagens por usuário
//   6. Cap mensal de custo por usuário
//   7. Modelo: valida preset ativo + text_only_mode
//   8. Sessão: cria ou valida existente
//   9. Chave do provider
//  10. Monta contexto (system + anexos + histórico últimas 10 msgs)
//  11. Chama provider via callProvider()
//  12. Persiste (user msg + assistant msg + cost)
//  13. Verifica thresholds de alerta pós-chamada
//  14. Retorna resposta
//
// Segurança:
//   - JWT obrigatório, service_role apenas para INSERTs de custo
//   - Rate limit: 20 msgs/min por usuário (RATE_LIMIT_PER_MIN em ai-security.ts)
//   - Anti-prompt injection: wrap obrigatório do user content
//   - Timeout fetch ao provider: 50s
//   - Nenhuma chave ou conteúdo de mensagem em console.log
//
// RAQ-MAND-EM075 — Onda 2

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/admin-guard.ts';
import {
  antiInjectionInstruction,
  isRateLimited,
  registerAICall,
  sanitizeFilenameForPrompt,
  sanitizeForLog,
  sanitizeLLMOutput,
  wrapUserContent,
} from '../_shared/ai-security.ts';
import { cachedGetUser } from '../_shared/auth-cache.ts';
import {
  callProvider,
  MULTIMODAL_MODELS,
  ProviderError,
} from '../_shared/agent-providers.ts';

const UUID_REGEX   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HISTORY_MSGS = 10;         // últimas N mensagens enviadas ao provider
const MAX_SYSTEM_CHARS = 50_000; // truncar system prompt total a 50K chars

// ── Autenticação básica (usuário autenticado) ─────────────────────────────────
// PEN-008: usa cachedGetUser para reduzir 2 round-trips de auth para 0 em bursts.
// O cliente admin é criado uma vez por request (client é stateless — criação é barata).

async function requireUserAuth(req: Request) {
  const url            = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY');

  if (!url || !serviceRoleKey || !anonKey) {
    return { error: jsonResponse(500, { error: 'Configuração incompleta' }) };
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { error: jsonResponse(401, { error: 'Token ausente' }) };

  // PEN-008: cachedGetUser faz getUser + busca perfil com cache 60s por token.
  // Reduz de 2 DB ops para 0 em request bursts no mesmo worker warm.
  let authData: { userId: string; userEmail: string; role: string; status: string };
  try {
    authData = await cachedGetUser(url, anonKey, serviceRoleKey, token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'sessao_invalida') return { error: jsonResponse(401, { error: 'Sessão inválida' }) };
    if (msg === 'perfil_nao_autorizado') return { error: jsonResponse(403, { error: 'Perfil não autorizado' }) };
    return { error: jsonResponse(500, { error: 'Erro ao validar perfil' }) };
  }

  // Admin client para as queries subsequentes (criação é barata — sem I/O)
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    admin,
    userId:    authData.userId,
    userEmail: authData.userEmail,
    userRole:  authData.role,
  };
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação ──────────────────────────────────────────────────────
    const authResult = await requireUserAuth(req);
    if ('error' in authResult) return authResult.error;

    const { admin, userId, userEmail, userRole } = authResult;

    // ── Rate limit: 20 msgs/min por usuário ──────────────────────────────────
    if (await isRateLimited(admin, userId, 'ai-agent-chat')) {
      return jsonResponse(429, { error: 'Limite de 20 mensagens por minuto atingido' });
    }

    // ── 2. Parse do body ─────────────────────────────────────────────────────
    let body: { session_id?: string | null; message?: string; model_id?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const sessionIdRaw = body.session_id ?? null;
    const message      = body.message?.trim();
    const modelIdReq   = body.model_id?.trim();

    if (!message || message.length === 0) {
      return jsonResponse(400, { error: 'Campo message obrigatório' });
    }
    if (message.length > 8_000) {
      return jsonResponse(400, { error: 'Mensagem muito longa (máx 8.000 chars)' });
    }
    if (sessionIdRaw !== null && !UUID_REGEX.test(sessionIdRaw)) {
      return jsonResponse(400, { error: 'session_id inválido' });
    }
    if (modelIdReq && modelIdReq.length > 100) {
      return jsonResponse(400, { error: 'model_id inválido' });
    }

    // ── 3. Carrega agente + budget ───────────────────────────────────────────
    // PEN-006: .limit(1) garante que maybeSingle() não lança PGRST116 mesmo se
    // houver >1 linha (constraint UNIQUE na migration 103 é a defesa primária).
    const { data: agent, error: agentErr } = await admin
      .from('ai_agents')
      .select('id, is_active, system_prompt, text_only_mode')
      .limit(1)
      .maybeSingle();

    if (agentErr || !agent) {
      return jsonResponse(200, { skipped: true, reason: 'agent_not_configured' });
    }

    if (!agent.is_active) {
      return jsonResponse(200, { skipped: true, reason: 'agent_inactive' });
    }

    const { data: budget } = await admin
      .from('ai_agent_budget')
      .select(
        'monthly_limit_brl, threshold_yellow_pct, threshold_red_pct, ' +
        'auto_block_at_100, max_tokens_per_response, ' +
        'max_messages_per_user_per_day, max_brl_per_user_per_month',
      )
      .eq('agent_id', agent.id)
      .maybeSingle();

    const monthlyLimit       = Number(budget?.monthly_limit_brl ?? 50);
    const thresholdYellow    = Number(budget?.threshold_yellow_pct ?? 70);
    const thresholdRed       = Number(budget?.threshold_red_pct ?? 90);
    const autoBlock          = budget?.auto_block_at_100 ?? true;
    const maxTokensPerResp   = Number(budget?.max_tokens_per_response ?? 2048);
    const maxMsgsPerDay      = Number(budget?.max_messages_per_user_per_day ?? 50);
    const maxBrlPerUserMonth = Number(budget?.max_brl_per_user_per_month ?? 25);

    // ── 4. RBAC: usuário pode ver o agente? ──────────────────────────────────
    const { data: perm } = await admin
      .from('permissoes_perfil')
      .select('pode_ver')
      .eq('role', userRole)
      .eq('secao', 'agente_ia')
      .maybeSingle();

    if (!perm || !perm.pode_ver) {
      return jsonResponse(403, { error: 'Sem permissão para usar o agente de IA' });
    }

    // ── 5-7. Validação de orçamento (global + cap diário + cap mensal) ───────
    // PEN-002: substituímos os 3 checks individuais (TOCTOU) por uma única RPC
    // com pg_advisory_xact_lock que serializa o check por usuário.
    // O lock é mantido até o commit do INSERT de custo (feito via RPC 101),
    // fechando a janela de race condition em requisições paralelas.
    {
      const { data: quotaResult, error: quotaErr } = await admin
        .rpc('ai_reserve_user_quota', {
          p_user_id:           userId,
          p_max_msgs_per_day:  maxMsgsPerDay,
          p_max_brl_per_month: maxBrlPerUserMonth,
          p_monthly_limit_brl: monthlyLimit,
          p_auto_block:        autoBlock,
        });

      if (quotaErr) {
        console.warn('ai-agent-chat: erro ao verificar quota', quotaErr.code);
        // Fail-safe: em caso de erro na RPC, bloqueia para proteger o budget
        return jsonResponse(500, { error: 'Erro ao verificar orçamento. Tente novamente.' });
      }

      const quota = quotaResult as { allowed: boolean; reason?: string; count?: number; limit?: number; spent?: number };

      if (!quota.allowed) {
        return jsonResponse(200, {
          skipped: true,
          reason:  quota.reason,
          ...(quota.count  !== undefined && { count:  quota.count }),
          ...(quota.limit  !== undefined && { limit:  quota.limit }),
          ...(quota.spent  !== undefined && { spent:  quota.spent }),
        });
      }
    }

    // ── 8. Determina o modelo a usar ─────────────────────────────────────────
    // Carrega preset ativo e seus modelos
    const { data: activePreset } = await admin
      .from('ai_agent_model_presets')
      .select('id')
      .eq('agent_id', agent.id)
      .eq('is_active_preset', true)
      .maybeSingle();

    if (!activePreset) {
      return jsonResponse(200, { skipped: true, reason: 'no_active_preset' });
    }

    let modelId: string;
    let provider: string;

    if (modelIdReq) {
      // Valida que o modelo solicitado está no preset ativo e está habilitado
      const { data: requestedModel } = await admin
        .from('ai_agent_models')
        .select('model_id, provider, enabled')
        .eq('preset_id', activePreset.id)
        .eq('model_id', modelIdReq)
        .maybeSingle();

      if (!requestedModel || !requestedModel.enabled) {
        return jsonResponse(400, { error: 'Modelo solicitado não disponível no preset ativo' });
      }
      modelId  = requestedModel.model_id as string;
      provider = requestedModel.provider as string;
    } else {
      // Usa o modelo default do preset ativo
      const { data: defaultModel } = await admin
        .from('ai_agent_models')
        .select('model_id, provider')
        .eq('preset_id', activePreset.id)
        .eq('is_default', true)
        .eq('enabled', true)
        .maybeSingle();

      if (!defaultModel) {
        return jsonResponse(200, { skipped: true, reason: 'no_default_model' });
      }
      modelId  = defaultModel.model_id as string;
      provider = defaultModel.provider as string;
    }

    // Valida text_only_mode
    if (agent.text_only_mode && MULTIMODAL_MODELS.has(modelId)) {
      return jsonResponse(400, {
        error:  'multimodal_blocked',
        detail: `Modelo ${modelId} é multimodal e text_only_mode está ativo`,
      });
    }

    // ── 9. Sessão ────────────────────────────────────────────────────────────
    let sessionId: string;

    if (!sessionIdRaw) {
      // Cria nova sessão com título = primeiros 60 chars da mensagem
      const title = message.slice(0, 60).trim();
      const { data: newSession, error: sessionErr } = await admin
        .from('ai_chat_sessions')
        .insert({ user_id: userId, title })
        .select('id')
        .single();

      if (sessionErr || !newSession) {
        console.error('ai-agent-chat: erro ao criar sessão', sessionErr?.code);
        return jsonResponse(500, { error: 'Erro ao criar sessão' });
      }
      sessionId = newSession.id as string;
    } else {
      // Valida que a sessão pertence ao usuário (RLS + redundância)
      const { data: existingSession } = await admin
        .from('ai_chat_sessions')
        .select('id')
        .eq('id', sessionIdRaw)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingSession) {
        return jsonResponse(403, { error: 'Sessão não encontrada ou sem permissão' });
      }
      sessionId = sessionIdRaw;
    }

    // ── 10. Carrega chave do provider ────────────────────────────────────────
    const { data: credRow } = await admin
      .from('ai_provider_credentials')
      .select('api_key, is_active')
      .eq('provider', provider)
      .maybeSingle();

    if (!credRow || !credRow.is_active || !credRow.api_key) {
      return jsonResponse(200, {
        skipped: true,
        reason:  'provider_not_configured',
        provider,
      });
    }

    const apiKey = credRow.api_key as string;

    // ── 11. Monta contexto ───────────────────────────────────────────────────
    // System prompt base
    let systemText = (agent.system_prompt as string | null) ?? '';

    // Injeta texto dos anexos do agente
    const { data: attachments } = await admin
      .from('ai_agent_attachments')
      .select('filename, extracted_text')
      .eq('agent_id', agent.id)
      .eq('status', 'ready')
      .not('extracted_text', 'is', null)
      .order('created_at', { ascending: true });

    // PEN-001 [CRÍTICA]: wrap anti-injection em CADA documento de contexto.
    // Antes, extracted_text era concatenado cru no system_prompt — admin comprometido
    // podia subir DOCX com payload que afetava TODOS os usuários persistentemente.
    // Cada anexo recebe fence único; antiInjectionInstruction bilíngue cobre todos.
    const docFenceIds: string[] = [];

    if (attachments && attachments.length > 0) {
      const docSections = attachments.map((a) => {
        // PEN-007: sanitizar filename para evitar quebra de contexto via chars bidi/markdown
        const safeFilename = sanitizeFilenameForPrompt(a.filename as string);
        const { wrapped, fenceId: docFenceId } = wrapUserContent(a.extracted_text as string, `documento ${safeFilename}`);
        docFenceIds.push(docFenceId);
        return `\n\n[Documento de contexto: ${safeFilename}]\n${wrapped}`;
      }).join('');
      systemText += docSections;
    }

    // Trunca system prompt total a 50K chars
    if (systemText.length > MAX_SYSTEM_CHARS) {
      systemText = systemText.slice(0, MAX_SYSTEM_CHARS) + '\n[...contexto truncado]';
      console.log('ai-agent-chat: system_prompt truncado', { sessionId });
    }

    // Histórico: últimas 10 mensagens da sessão (apenas user/assistant)
    const { data: historyRows } = await admin
      .from('ai_chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(HISTORY_MSGS);

    // PEN-010 [MÉDIA]: re-aplicar wrap nas mensagens do usuário do histórico.
    // Mensagens históricas iam cruas para o provider — multi-turn injection:
    // turn 1 com payload malicioso ficava no histórico sem fence.
    const historyMessages = (historyRows ?? [])
      .reverse()
      .map((m) => {
        if (m.role === 'user') {
          const { wrapped } = wrapUserContent(m.content as string);
          return { role: 'user' as const, content: wrapped };
        }
        return { role: 'assistant' as const, content: m.content as string };
      });

    // Wrap anti-prompt injection na mensagem atual do usuário
    // PEN-001: instrução consolidada cobre fence do user msg + todos os fences dos anexos
    const { wrapped: wrappedUserMsg, fenceId } = wrapUserContent(message);

    // Monta instrução de segurança cobrindo TODOS os fences (user + documentos)
    const allFenceIds = [fenceId, ...docFenceIds];
    const securityInstructions = allFenceIds.map((id) => antiInjectionInstruction(id)).join('\n');
    systemText = securityInstructions + '\n\n' + systemText;

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...historyMessages,
      { role: 'user', content: wrappedUserMsg },
    ];

    // ── 12. Registra rate-limit + chama provider ─────────────────────────────
    await registerAICall(admin, userId, 'ai-agent-chat');

    let providerResult: Awaited<ReturnType<typeof callProvider>>;
    try {
      providerResult = await callProvider({
        provider,
        modelId,
        apiKey,
        systemPrompt: systemText,
        messages,
        maxTokens: maxTokensPerResp,
        temperature: 0.7,
      });
    } catch (provErr) {
      const msg = provErr instanceof Error ? provErr.message : String(provErr);
      console.error('ai-agent-chat: provider error', sanitizeForLog(msg));

      if (provErr instanceof ProviderError && provErr.httpStatus === 429) {
        return jsonResponse(200, { skipped: true, reason: 'provider_rate_limit' });
      }
      return jsonResponse(200, { skipped: true, reason: 'provider_error' });
    }

    // ── 13. Persiste mensagens ───────────────────────────────────────────────
    // INSERT da mensagem do usuário
    const { data: userMsg, error: userMsgErr } = await admin
      .from('ai_chat_messages')
      .insert({
        session_id: sessionId,
        role:       'user',
        content:    message, // salva a mensagem original, sem o wrap
      })
      .select('id')
      .single();

    if (userMsgErr || !userMsg) {
      console.error('ai-agent-chat: erro ao persistir msg user', userMsgErr?.code);
      // Não bloqueia — retorna resposta mesmo sem persistir a msg do usuário
    }

    // PEN-004: sanitizar output do LLM antes de persistir
    // Remove <script>, <iframe>, event handlers e URIs javascript: preservando markdown válido
    const sanitizedContent = sanitizeLLMOutput(providerResult.content);

    // PEN-003: INSERT atômico via RPC — mensagem do assistente + custo na mesma transação.
    // Se o INSERT do custo falhar, a mensagem NÃO entra — elimina o fail-open silencioso
    // que permitia consumo ilimitado sem rastreamento de budget.
    const { data: atomicResult, error: atomicErr } = await admin
      .rpc('ai_record_assistant_message', {
        p_session_id:      sessionId,
        p_content:         sanitizedContent,
        p_provider:        provider,
        p_model_id:        modelId,
        p_tokens_input:    providerResult.tokens_input,
        p_tokens_output:   providerResult.tokens_output,
        p_total_tokens:    providerResult.total_tokens,
        p_cost_brl_input:  providerResult.cost_brl_input,
        p_cost_brl_output: providerResult.cost_brl_output,
        p_total_cost_brl:  providerResult.cost_brl,
        p_user_id:         userId,
      });

    if (atomicErr) {
      // Falha no INSERT atômico: retorna 500 para não servir resposta sem rastreamento de custo
      console.error('ai-agent-chat: falha no INSERT atômico msg+custo', atomicErr.code);
      return jsonResponse(500, {
        error: 'Erro ao registrar resposta. Tente novamente.',
        hint:  'budget_tracking_failed',
      });
    }

    const assistantMsgId = (atomicResult as { message_id: string } | null)?.message_id ?? null;

    // UPDATE last_message_at na sessão
    await admin
      .from('ai_chat_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', sessionId)
      .catch(() => null);

    // ── 14. Verifica thresholds pós-chamada ──────────────────────────────────
    try {
      const { data: newSpendRaw } = await admin
        .rpc('ai_agent_current_spend', { p_agent_id: agent.id });

      const newSpend = Number(newSpendRaw ?? 0);
      const monthYear = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

      const pct = monthlyLimit > 0 ? (newSpend / monthlyLimit) * 100 : 0;

      const checkThreshold = async (level: 'yellow' | 'red', threshold: number) => {
        if (pct >= threshold) {
          await admin
            .from('ai_budget_alerts_sent')
            .insert({ agent_id: agent.id, threshold_level: level, month_year: monthYear })
            .catch(() => null); // ignora conflito UNIQUE (alerta já enviado este mês)
        }
      };

      await Promise.all([
        checkThreshold('yellow', thresholdYellow),
        checkThreshold('red', thresholdRed),
      ]);

      if (pct >= 100) {
        await admin
          .from('ai_budget_alerts_sent')
          .insert({ agent_id: agent.id, threshold_level: 'hard_block', month_year: monthYear })
          .catch(() => null);
      }
    } catch {
      // Threshold check não deve bloquear a resposta
    }

    // ── 15. Retorna ──────────────────────────────────────────────────────────
    console.log('ai-agent-chat: ok', {
      sessionId,
      provider,
      totalTokens: providerResult.total_tokens,
    });

    return jsonResponse(200, {
      reply:       sanitizedContent,
      session_id:  sessionId,
      message_id:  assistantMsgId,
      model_used:  modelId,
      tokens: {
        input:  providerResult.tokens_input,
        output: providerResult.tokens_output,
        total:  providerResult.total_tokens,
      },
      cost_brl: providerResult.cost_brl,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('ai-agent-chat crash:', sanitizeForLog(msg));
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
