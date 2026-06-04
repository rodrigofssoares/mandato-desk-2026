// Edge Function: zapi-set-panel-password
//
// Define, altera ou remove a senha do painel de conversas de uma conta Z-API.
// Somente admins (role = 'admin', nível 100) podem chamar esta função.
//
// Fluxo — definir/alterar senha (new_password: string):
//   1. Valida JWT e confirma role = admin (nível 100 via requireAuth + check manual).
//      NOTA: NÃO usa requireAdmin (que deixaria assessor/proprietario passar, nível ≥ 50).
//      Usa requireAuth + callerRole !== 'admin' — exige nível 100 exato.
//   2. Guard de Content-Length (máx 4KB).
//   3. Valida { account_id, new_password } do body.
//   4. Confirma que a conta existe em zapi_accounts.
//   5. Gera salt aleatório + hash PBKDF2-SHA256 (100k iterações) via Web Crypto.
//      Formato armazenado: "pbkdf2$iteracoes$salt_hex$hash_hex"
//   6. Upsert em zapi_panel_passwords (onConflict account_id).
//   7. Invalida todos os grants da conta (senha trocou → forçar revalidação).
//   8. Retorna { ok: true }.
//
// Fluxo — remover senha (new_password: null):
//   1-4. Idem ao acima (auth, guard, validação de conta).
//   5. Deleta o registro em zapi_panel_passwords.
//   6. Deleta TODOS os grants ativos da conta (F3 Security-Fix).
//   7. Deleta linhas de rate-limit da conta (limpeza).
//   8. Retorna { ok: true }.
//
// Segurança:
//   - Role admin-only nível 100 (enforced server-side via requireAuth + check callerRole).
//     NÃO usa requireAdmin pois este helper permite assessor/proprietario (nível ≥ 50).
//   - PBKDF2-SHA256 100k iterações: resistente a ataques de força bruta.
//   - Web Crypto (Deno nativo): sem libs bcrypt de terceiros.
//   - Senha nunca logada nem retornada.
//   - Parâmetros de entrada limpos antes de usar.
//   - Remoção invalida grants ativos imediatamente (F3 Security-Fix).
//
// Reference: RAQ-MAND-EM078 — T2 (EF set-password) + Security-Fix F3/F4/F6

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

    // ── F6: Guard de Content-Length (máx 4KB) ───────────────────────────────
    if (parseInt(req.headers.get('content-length') ?? '0', 10) > 4096) {
      return jsonResponse(413, { error: 'Payload muito grande' });
    }

    // ── 1. Autenticação e autorização: somente admin (nível 100) ─────────────
    // ATENÇÃO: usa requireAuth (não requireAdmin) pois requireAdmin permite assessor/
    // proprietario (nível ≥ 50). Aqui exigimos nível 100 (admin) exato.
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerRole } = guard;

    // Verifica role admin (nível 100) — admin-only, não assessor/proprietario
    if (callerRole !== 'admin') {
      return jsonResponse(403, {
        error: 'Apenas administradores podem definir senhas do painel',
      });
    }

    // ── 2. Parse e validação do body ─────────────────────────────────────────
    let body: { account_id?: string; new_password?: string | null };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const accountId = body.account_id?.trim();
    // new_password = null significa "remover senha"; string = definir/alterar
    const newPassword = body.new_password;

    if (!accountId) {
      return jsonResponse(400, { error: 'account_id é obrigatório' });
    }
    if (!UUID_REGEX.test(accountId)) {
      return jsonResponse(400, { error: 'account_id deve ser um UUID válido' });
    }

    // Valida senha apenas quando estamos definindo (não removendo)
    if (newPassword !== null && newPassword !== undefined) {
      if (newPassword.length < 8) {
        return jsonResponse(400, { error: 'Senha deve ter pelo menos 8 caracteres' });
      }
      if (newPassword.length > 100) {
        return jsonResponse(400, { error: 'Senha não pode ter mais de 100 caracteres' });
      }
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

    // ── Fluxo: remover senha (new_password === null) ─────────────────────────
    if (newPassword === null || newPassword === undefined) {
      // Deleta o hash de senha
      const { error: delPassErr } = await admin
        .from('zapi_panel_passwords')
        .delete()
        .eq('account_id', accountId);

      if (delPassErr) {
        console.error('zapi-set-panel-password: erro ao remover senha', { code: delPassErr.code });
        return jsonResponse(500, { error: 'Erro ao remover senha' });
      }

      // F3: deleta TODOS os grants ativos da conta — estagiários perdem acesso imediatamente
      const { error: grantDelErr } = await admin
        .from('zapi_panel_grants')
        .delete()
        .eq('account_id', accountId);

      if (grantDelErr) {
        console.warn('zapi-set-panel-password: falha ao invalidar grants ao remover senha', {
          code: grantDelErr.code,
        });
        // Não-fatal mas logado — grants vão expirar em 8h no pior caso
      }

      // Limpeza: remove linhas de rate-limit da conta
      await admin
        .from('zapi_panel_rate_limits')
        .delete()
        .eq('account_id', accountId)
        .then(({ error: rlDelErr }) => {
          if (rlDelErr) {
            console.warn('zapi-set-panel-password: falha ao limpar rate_limits ao remover senha', {
              code: rlDelErr.code,
            });
          }
        });

      console.log('zapi-set-panel-password: senha removida + grants invalidados', {
        callerId,
        accountId,
        accountName: account.name,
      });

      return jsonResponse(200, { ok: true });
    }

    // ── Fluxo: definir/alterar senha ─────────────────────────────────────────

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
