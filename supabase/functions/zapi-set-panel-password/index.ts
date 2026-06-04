// Edge Function: zapi-set-panel-password
//
// Define ou altera a senha do painel de conversas de uma conta Z-API.
// Somente admins podem chamar esta função.
//
// Fluxo:
//   1. Valida JWT e confirma role = admin (requireAdmin).
//   2. Valida { account_id, new_password } do body.
//   3. Confirma que a conta existe em zapi_accounts.
//   4. Gera salt aleatório + hash PBKDF2-SHA256 (100k iterações) via Web Crypto.
//      Formato armazenado: "pbkdf2$iteracoes$salt_hex$hash_hex"
//   5. Upsert em zapi_panel_passwords (onConflict account_id).
//   6. Retorna { ok: true }.
//
// Segurança:
//   - Role admin-only (enforced server-side via requireAdmin — nível ≥ admin).
//   - PBKDF2-SHA256 100k iterações: resistente a ataques de força bruta.
//   - Web Crypto (Deno nativo): sem libs bcrypt de terceiros.
//   - Senha nunca logada nem retornada.
//   - Parâmetros de entrada limpos antes de usar.
//
// Reference: RAQ-MAND-EM078 — T2 (EF set-password)

import { corsHeaders, jsonResponse } from '../_shared/admin-guard.ts';
import { requireAuth } from '../_shared/auth-guard.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── PBKDF2 helpers ──────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000;

/** Converte ArrayBuffer → string hexadecimal. */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Gera hash PBKDF2-SHA256 da senha.
 * Formato do string armazenado: "pbkdf2$iteracoes$salt_hex$hash_hex"
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // Salt aleatório de 16 bytes (128 bits)
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));

  // Importa a senha como CryptoKey
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  // Deriva 256 bits usando PBKDF2-SHA256
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  const saltHex = bufToHex(saltBytes.buffer);
  const hashHex = bufToHex(derivedBits);

  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

    // ── 1. Autenticação e autorização: somente admin ─────────────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerRole } = guard;

    // Verifica role admin (nível 100)
    if (callerRole !== 'admin') {
      return jsonResponse(403, {
        error: 'Apenas administradores podem definir senhas do painel',
      });
    }

    // ── 2. Parse e validação do body ─────────────────────────────────────────
    let body: { account_id?: string; new_password?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const accountId = body.account_id?.trim();
    const newPassword = body.new_password ?? '';

    if (!accountId) {
      return jsonResponse(400, { error: 'account_id é obrigatório' });
    }
    if (!UUID_REGEX.test(accountId)) {
      return jsonResponse(400, { error: 'account_id deve ser um UUID válido' });
    }
    if (newPassword.length < 8) {
      return jsonResponse(400, { error: 'Senha deve ter pelo menos 8 caracteres' });
    }
    if (newPassword.length > 100) {
      return jsonResponse(400, { error: 'Senha não pode ter mais de 100 caracteres' });
    }

    // ── 3. Confirma que a conta existe ───────────────────────────────────────
    const { data: account, error: accountErr } = await admin
      .from('zapi_accounts')
      .select('id, name')
      .eq('id', accountId)
      .maybeSingle();

    if (accountErr) {
      console.error('zapi-set-panel-password: erro ao buscar conta', { code: accountErr.code });
      return jsonResponse(500, { error: 'Erro ao verificar conta' });
    }
    if (!account) {
      return jsonResponse(404, { error: 'Conta Z-API não encontrada' });
    }

    // ── 4. Gera hash PBKDF2-SHA256 ──────────────────────────────────────────
    const passwordHash = await hashPassword(newPassword);

    // ── 5. Upsert em zapi_panel_passwords ───────────────────────────────────
    const { error: upsertErr } = await admin
      .from('zapi_panel_passwords')
      .upsert(
        {
          account_id: accountId,
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
          updated_by: callerId,
        },
        { onConflict: 'account_id' },
      );

    if (upsertErr) {
      console.error('zapi-set-panel-password: erro ao salvar hash', { code: upsertErr.code });
      return jsonResponse(500, { error: 'Erro ao salvar senha' });
    }

    // Invalida todos os grants existentes para esta conta (senha trocou → forçar revalidação)
    const { error: grantErr } = await admin
      .from('zapi_panel_grants')
      .delete()
      .eq('account_id', accountId);

    if (grantErr) {
      // Não-fatal: grants vão expirar naturalmente. Log apenas.
      console.warn('zapi-set-panel-password: falha ao invalidar grants', { code: grantErr.code });
    }

    console.log('zapi-set-panel-password: senha definida', {
      callerId,
      accountId,
      accountName: account.name,
    });

    return jsonResponse(200, { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('zapi-set-panel-password crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
