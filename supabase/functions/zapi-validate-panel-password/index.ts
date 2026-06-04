// Edge Function: zapi-validate-panel-password
//
// Valida a senha do painel de conversas de uma conta Z-API e emite um grant
// server-side com TTL de 8 horas.
//
// Fluxo:
//   1. Valida JWT (qualquer usuário autenticado com perfil ATIVO).
//   2. Valida { account_id, password } do body.
//   3. Rate-limit: máx 5 tentativas / 15min por (user_id, account_id).
//      Armazenado em memória por worker (resets com deploy, mas suficiente pra MVP).
//      Após lockout → 429 com tempo restante.
//   4. Busca hash em zapi_panel_passwords (service_role).
//   5. Compare constant-time PBKDF2-SHA256.
//   6. Sucesso → upsert grant em zapi_panel_grants com expires_at = now() + 8h.
//      Limpa grants expirados do próprio usuário (housekeeping on-validate).
//   7. Falha → incrementa contador. Nunca confirma se conta tem ou não senha.
//
// Segurança:
//   - Compare constant-time via timingSafeEqual (Web Crypto / Deno).
//   - Rate-limit: 5/15min por (user_id, account_id) → previne força bruta.
//   - Resposta de erro genérica ("credenciais inválidas") — não vaza detalhes.
//   - Grant criado via service_role — usuário não pode criar/alterar diretamente.
//   - TTL do grant: 8 horas. Após expirar, RLS bloqueia SELECT nas tabelas.
//
// Reference: RAQ-MAND-EM078 — T2 (EF validate-password)

import { corsHeaders, jsonResponse } from '../_shared/admin-guard.ts';
import { requireAuth } from '../_shared/auth-guard.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// TTL do grant: 8 horas
const GRANT_TTL_MS = 8 * 60 * 60 * 1000;

// ─── Rate-limit em memória ───────────────────────────────────────────────────
// Chave: "{user_id}:{account_id}" → { count, firstAttempt }
// Limite: 5 tentativas / 15 minutos

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

interface RateEntry {
  count: number;
  firstAttempt: number; // timestamp ms
}

const rateMap = new Map<string, RateEntry>();

function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry) {
    rateMap.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  // Janela expirou → reseta
  if (now - entry.firstAttempt >= RATE_LIMIT_WINDOW_MS) {
    rateMap.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  // Dentro da janela
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.firstAttempt);
    return { allowed: false, retryAfterMs };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

function resetRateLimit(key: string) {
  rateMap.delete(key);
}

// ─── PBKDF2 helpers ──────────────────────────────────────────────────────────

function hexToBuf(hex: string): Uint8Array {
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return result;
}

/**
 * Compare constant-time entre dois Uint8Array.
 * Evita timing attacks — percorre sempre o array inteiro independente de diferenças.
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Valida a senha contra o hash armazenado.
 * Formato do hash: "pbkdf2$iteracoes$salt_hex$hash_hex"
 */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    console.warn('zapi-validate-panel-password: hash com formato desconhecido');
    return false;
  }

  const iterations = parseInt(parts[1], 10);
  const saltHex = parts[2];
  const expectedHashHex = parts[3];

  if (isNaN(iterations) || iterations < 1) return false;

  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = hexToBuf(saltHex);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  const derivedBytes = new Uint8Array(derivedBits);
  const expectedBytes = hexToBuf(expectedHashHex);

  return constantTimeEqual(derivedBytes, expectedBytes);
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

    // ── 1. Autenticação: qualquer usuário com perfil ATIVO ───────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId } = guard;

    // ── 2. Parse e validação do body ─────────────────────────────────────────
    let body: { account_id?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const accountId = body.account_id?.trim();
    const password = body.password ?? '';

    if (!accountId) {
      return jsonResponse(400, { error: 'account_id é obrigatório' });
    }
    if (!UUID_REGEX.test(accountId)) {
      return jsonResponse(400, { error: 'account_id deve ser um UUID válido' });
    }
    if (!password) {
      return jsonResponse(400, { error: 'password é obrigatório' });
    }

    // ── 3. Rate-limit ────────────────────────────────────────────────────────
    const rateLimitKey = `${callerId}:${accountId}`;
    const { allowed, retryAfterMs } = checkRateLimit(rateLimitKey);

    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      console.warn('zapi-validate-panel-password: rate-limit atingido', {
        callerId,
        accountId,
        retryAfterSec,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Muitas tentativas. Aguarde antes de tentar novamente.',
          retry_after_seconds: retryAfterSec,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfterSec),
          },
        },
      );
    }

    // ── 4. Busca hash armazenado (service_role) ──────────────────────────────
    const { data: row, error: passErr } = await admin
      .from('zapi_panel_passwords')
      .select('password_hash')
      .eq('account_id', accountId)
      .maybeSingle();

    if (passErr) {
      console.error('zapi-validate-panel-password: erro ao buscar hash', { code: passErr.code });
      return jsonResponse(500, { error: 'Erro ao validar credenciais' });
    }

    // Sem senha definida ou senha incorreta → mesma resposta genérica (não vazar estado)
    if (!row || !row.password_hash) {
      // Conta sem senha → simula delay constante para não vazar estado
      await new Promise((r) => setTimeout(r, 200));
      console.warn('zapi-validate-panel-password: conta sem senha ou inválida', { accountId });
      return jsonResponse(401, { ok: false, error: 'Credenciais inválidas' });
    }

    // ── 5. Compare constant-time ─────────────────────────────────────────────
    const valid = await verifyPassword(password, row.password_hash);

    if (!valid) {
      console.warn('zapi-validate-panel-password: senha incorreta', { callerId, accountId });
      return jsonResponse(401, { ok: false, error: 'Credenciais inválidas' });
    }

    // ── 6. Senha correta → emite grant ───────────────────────────────────────

    // Reseta rate-limit após sucesso
    resetRateLimit(rateLimitKey);

    const expiresAt = new Date(Date.now() + GRANT_TTL_MS).toISOString();

    // Limpa grants expirados do próprio usuário (housekeeping on-validate)
    try {
      await admin
        .from('zapi_panel_grants')
        .delete()
        .eq('user_id', callerId)
        .lt('expires_at', new Date().toISOString());
    } catch (cleanErr) {
      // Não-fatal
      console.warn('zapi-validate-panel-password: falha ao limpar grants expirados', cleanErr);
    }

    // Upsert grant (UNIQUE user_id + account_id → renova TTL)
    const { error: grantErr } = await admin
      .from('zapi_panel_grants')
      .upsert(
        {
          user_id: callerId,
          account_id: accountId,
          granted_at: new Date().toISOString(),
          expires_at: expiresAt,
        },
        { onConflict: 'user_id,account_id' },
      );

    if (grantErr) {
      console.error('zapi-validate-panel-password: erro ao criar grant', { code: grantErr.code });
      return jsonResponse(500, { error: 'Erro ao registrar acesso' });
    }

    console.log('zapi-validate-panel-password: grant emitido', {
      callerId,
      accountId,
      expiresAt,
    });

    return jsonResponse(200, { ok: true, expires_at: expiresAt });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('zapi-validate-panel-password crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
