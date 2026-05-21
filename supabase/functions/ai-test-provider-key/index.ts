// Edge Function: ai-test-provider-key
//
// Valida uma chave de API de provider de IA antes de ser salva no banco.
// Faz uma chamada leve ao provider e retorna ok/erro sem expor detalhes da chave.
//
// POST { provider: 'openai'|'anthropic'|'openrouter', api_key: string }
// →    { ok: boolean, error?: string, models_count?: number }
//
// Segurança:
//   - JWT obrigatório + role admin (ROLE_LEVELS >= 100)
//   - Rate limit: 5 testes/min por admin (ai_rate_limit)
//   - Chave nunca aparece em logs (sanitizeForLog)
//   - Evento registrado em ai_rate_limit para auditoria (uso indevido do endpoint)
//
// RAQ-MAND-EM075 — Onda 2

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, requireAdmin } from '../_shared/admin-guard.ts';
import { sanitizeForLog } from '../_shared/ai-security.ts';

const ADMIN_LEVEL = 100; // só role='admin' pode testar chaves

// Limite estrito: 5 testes de chave por minuto (anti-brute-force)
const RATE_LIMIT_TEST_KEY = 5;

interface TestKeyBody {
  provider?: string;
  api_key?: string;
}

interface TestResult {
  ok: boolean;
  error?: string;
  models_count?: number;
}

// ── Testadores por provider ───────────────────────────────────────────────────

async function testOpenAI(apiKey: string): Promise<TestResult> {
  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: 'network_error' };
  }

  if (res.status === 200) {
    let count: number | undefined;
    try {
      const data = await res.json() as { data?: unknown[] };
      count = data?.data?.length;
    } catch { /* ignora parse error */ }
    return { ok: true, models_count: count };
  }
  if (res.status === 401) return { ok: false, error: 'invalid_key' };
  if (res.status === 402) return { ok: false, error: 'insufficient_balance' };
  await res.text().catch(() => null);
  return { ok: false, error: 'unknown' };
}

async function testAnthropic(apiKey: string): Promise<TestResult> {
  // Anthropic não tem /models público — fazemos um ping mínimo com max_tokens=1
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: 'network_error' };
  }

  // 200 ou 400 (bad request mas chave válida) significam chave OK
  if (res.status === 200 || res.status === 400) {
    await res.text().catch(() => null);
    return { ok: true };
  }
  if (res.status === 401) return { ok: false, error: 'invalid_key' };
  if (res.status === 402) return { ok: false, error: 'insufficient_balance' };
  await res.text().catch(() => null);
  return { ok: false, error: 'unknown' };
}

async function testOpenRouter(apiKey: string): Promise<TestResult> {
  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://mandato-desk-2026.pages.dev',
        'X-Title': 'Mandato Desk 2026',
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: 'network_error' };
  }

  if (res.status === 200) {
    let count: number | undefined;
    try {
      const data = await res.json() as { data?: unknown[] };
      count = data?.data?.length;
    } catch { /* ignora */ }
    return { ok: true, models_count: count };
  }
  if (res.status === 401) return { ok: false, error: 'invalid_key' };
  if (res.status === 402) return { ok: false, error: 'insufficient_balance' };
  await res.text().catch(() => null);
  return { ok: false, error: 'unknown' };
}

// ── Verifica rate limit específico de teste de chave ─────────────────────────
// ai_rate_limit registra todas as chamadas de IA — mas o limite padrão é 20/min.
// Para teste de chave, aplicamos limite estrito de 5/min lendo a mesma tabela
// mas com contador diferente (ef_name = 'ai-test-provider-key').

async function isTestKeyRateLimited(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await admin
    .from('ai_rate_limit')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('ef_name', 'ai-test-provider-key')
    .gte('called_at', since);

  if (error) return false; // fail-open
  return (count ?? 0) >= RATE_LIMIT_TEST_KEY;
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação + role admin ─────────────────────────────────────────
    const guard = await requireAdmin(req);
    if (guard instanceof Response) return guard;

    if (guard.callerLevel < ADMIN_LEVEL) {
      return jsonResponse(403, { error: 'Apenas administradores podem testar chaves de API' });
    }

    const { admin, callerId } = guard;

    // ── 2. Rate limit estrito (5/min) ────────────────────────────────────────
    if (await isTestKeyRateLimited(admin, callerId)) {
      return jsonResponse(429, { error: 'Limite de 5 testes por minuto atingido' });
    }

    // ── 3. Parse do body ─────────────────────────────────────────────────────
    let body: TestKeyBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const provider = body.provider?.trim().toLowerCase();
    const apiKey   = body.api_key?.trim();

    if (!provider || !['openai', 'anthropic', 'openrouter'].includes(provider)) {
      return jsonResponse(400, { error: 'provider deve ser openai, anthropic ou openrouter' });
    }
    if (!apiKey || apiKey.length < 10) {
      return jsonResponse(400, { error: 'api_key inválida' });
    }

    // ── 4. Registra chamada pra rate-limit tracking ──────────────────────────
    // Supabase query builder nao tem .catch — usar try/catch around the await
    try {
      await admin
        .from('ai_rate_limit')
        .insert({ user_id: callerId, ef_name: 'ai-test-provider-key' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('ai-test-provider-key: rate-limit insert falhou', sanitizeForLog(msg));
    }

    // ── 5. Testa a chave no provider ─────────────────────────────────────────
    let result: TestResult;
    try {
      if (provider === 'openai') {
        result = await testOpenAI(apiKey);
      } else if (provider === 'anthropic') {
        result = await testAnthropic(apiKey);
      } else {
        result = await testOpenRouter(apiKey);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('ai-test-provider-key: erro inesperado', sanitizeForLog(msg));
      return jsonResponse(200, { ok: false, error: 'unknown' });
    }

    // ── 6. Atualiza last_test_status no banco (best-effort) ──────────────────
    const status = result.ok ? 'valid' : 'invalid';
    try {
      await admin
        .from('ai_provider_credentials')
        .update({ last_tested_at: new Date().toISOString(), last_test_status: status })
        .eq('provider', provider);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('ai-test-provider-key: update status falhou', sanitizeForLog(msg));
    }

    console.log('ai-test-provider-key: teste executado', {
      caller: callerId,
      provider,
      ok: result.ok,
    });

    return jsonResponse(200, result);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 4).join(' | ') : '';
    console.error('ai-test-provider-key crash:', sanitizeForLog(msg), '|', sanitizeForLog(stack ?? ''));
    return jsonResponse(500, { error: `Erro interno: ${msg}`, _debug_stack: stack });
  }
});
