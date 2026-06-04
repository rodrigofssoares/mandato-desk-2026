// Edge Function: zapi-restore-history
//
// Recupera um lote de histórico da lixeira dentro do prazo de 7 dias.
// Admin-only (pode_deletar_em_massa=true em permissoes_perfil para 'whatsapp').
//
// Fluxo:
//   1. Valida JWT (qualquer usuário com perfil ATIVO).
//   2. Verifica permissão: pode_deletar_em_massa=true em permissoes_perfil para 'whatsapp'.
//      Admin sempre passa.
//   3. Valida body { batch_id } (UUID válido).
//   4. Busca o batch. Retorna 404 se não existe, 410 se expirado, 409 se já restaurado.
//   5. Re-executa o predicado dos filtros do batch com UPDATE deleted_at=NULL
//      (usando cleanup-predicate.ts, flag restore=true).
//   6. Atualiza batch.status='restored'.
//   7. Retorna { ok, restored_count }.
//
// Segurança:
//   - Verificação de permissão server-side (admin-only por padrão — não delegável).
//   - batch_id validado como UUID.
//   - Predicado de restauração usa deleted_by=batch.initiated_by para não tocar
//     registros apagados por outros batches/operações na mesma conta.
//   - Log de auditoria sem PII de conteúdo.
//
// Referência: RAQ-MAND-EM082 — T03

import { corsHeaders, jsonResponse } from '../_shared/admin-guard.ts';
import { requireAuth } from '../_shared/auth-guard.ts';
import {
  executeCleanupPredicate,
  type CleanupFilters,
  type CleanupMode,
} from '../_shared/cleanup-predicate.ts';

// ─── Validação ────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_REGEX.test(v);
}

// ─── Tipo do batch retornado pelo banco ───────────────────────────────────────

interface BatchRow {
  id: string;
  account_id: string;
  initiated_by: string;
  mode: string;
  filters: Record<string, unknown>;
  status: string;
  expires_at: string;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação ──────────────────────────────────────────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerEmail, callerRole } = guard;

    // ── 2. Autorização: pode_deletar_em_massa em 'whatsapp' (admin-only) ─────
    //
    // Restauração de lixeira é restrita a quem tem pode_deletar_em_massa=true.
    // Por padrão, apenas admin tem essa flag. Não é delegável via matriz de permissões
    // (a coluna existe mas o seed mantém apenas admin=true).
    const isAdmin = callerRole === 'admin';
    if (!isAdmin) {
      const { data: perm, error: permErr } = await admin
        .from('permissoes_perfil')
        .select('pode_deletar_em_massa')
        .eq('role', callerRole)
        .eq('secao', 'whatsapp')
        .maybeSingle();

      if (permErr) {
        console.error('zapi-restore-history: erro ao verificar permissão', {
          code: permErr.code,
          callerId,
        });
        return jsonResponse(500, { error: 'Erro ao verificar permissões' });
      }

      if (!perm || perm.pode_deletar_em_massa !== true) {
        console.warn('zapi-restore-history: acesso negado (sem pode_deletar_em_massa)', {
          callerId,
          callerRole,
        });
        return jsonResponse(403, { error: 'Sem permissão para restaurar histórico da lixeira. Apenas administradores.' });
      }
    }

    // ── 3. Parse e validação do body ─────────────────────────────────────────
    let rawBody: { batch_id?: unknown };
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const { batch_id } = rawBody;
    if (!isValidUUID(batch_id)) {
      return jsonResponse(400, { error: 'batch_id deve ser um UUID válido' });
    }

    // ── 4. Buscar batch ───────────────────────────────────────────────────────
    const { data: batch, error: batchErr } = await admin
      .from('zapi_cleanup_batches')
      .select('id, account_id, initiated_by, mode, filters, status, expires_at')
      .eq('id', batch_id)
      .maybeSingle<BatchRow>();

    if (batchErr) {
      console.error('zapi-restore-history: erro ao buscar batch', {
        code: batchErr.code,
        batch_id,
      });
      return jsonResponse(500, { error: 'Erro ao buscar lote' });
    }

    if (!batch) {
      return jsonResponse(404, { error: 'Lote não encontrado' });
    }

    // Status gates
    if (batch.status === 'expired') {
      return jsonResponse(410, { error: 'Prazo de restauração expirado. Os dados foram removidos definitivamente.' });
    }
    if (batch.status === 'restored') {
      return jsonResponse(409, { error: 'Este lote já foi restaurado anteriormente.' });
    }

    // Verificação extra de expires_at (o cron pode ter atrasado)
    if (new Date(batch.expires_at) < new Date()) {
      // Marcar como expirado e retornar 410
      await admin
        .from('zapi_cleanup_batches')
        .update({ status: 'expired' })
        .eq('id', batch.id);
      return jsonResponse(410, { error: 'Prazo de restauração expirado. Os dados foram removidos definitivamente.' });
    }

    // ── 5. Re-executar predicado em modo restauração ─────────────────────────
    //
    // O predicado usa os filtros gravados no batch (modo + filters originais).
    // A flag restore=true inverte o UPDATE: deleted_at=NULL / deleted_by=NULL.
    // O parâmetro restore_initiated_by=batch.initiated_by garante que só os
    // registros apagados por ESTA operação são restaurados — não toca registros
    // apagados por outros batches na mesma conta.
    let restoredCount = 0;
    try {
      const result = await executeCleanupPredicate(
        admin,
        {
          mode: batch.mode as CleanupMode,
          filters: batch.filters as CleanupFilters,
          account_id: batch.account_id,
          caller_id: callerId,
          restore_initiated_by: batch.initiated_by,
        },
        true, // restore
      );
      restoredCount = result.row_count;
    } catch (execErr) {
      const msg = execErr instanceof Error ? execErr.message : String(execErr);
      console.error('zapi-restore-history: erro no predicado de restauração', {
        callerId,
        batch_id,
        error: msg,
      });
      return jsonResponse(500, { error: `Erro ao restaurar histórico: ${msg}` });
    }

    // ── 6. Atualizar batch.status = 'restored' ────────────────────────────────
    const { error: updateErr } = await admin
      .from('zapi_cleanup_batches')
      .update({ status: 'restored' })
      .eq('id', batch.id);

    if (updateErr) {
      // Não é fatal — os dados já foram restaurados; só o status ficou desatualizado.
      // O cron de expiração vai marcar 'expired' depois, mas os dados voltaram.
      console.warn('zapi-restore-history: falha ao atualizar status do batch', {
        code: updateErr.code,
        batch_id,
      });
    }

    // ── 7. Retorno + log de auditoria ─────────────────────────────────────────
    console.log('zapi-restore-history: restauração concluída', {
      caller: callerEmail,
      callerId,
      batch_id,
      account_id: batch.account_id,
      mode: batch.mode,
      restored_count: restoredCount,
    });

    return jsonResponse(200, {
      ok: true,
      restored_count: restoredCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('zapi-restore-history crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
